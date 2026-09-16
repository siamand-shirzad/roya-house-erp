import { can, type Module } from "../lib/permissions";
import { Router, type Response } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, queryOne, newId, withTransaction } from "../lib/db";
import { computeDocumentTotals } from "../lib/totals";
import type { AuthUser } from "../lib/auth";
import { currentCompany, rowToCompany } from "./company";
import {
  postGoodsIssueMovements,
  reverseGoodsIssueMovements,
  stockShortfalls,
  type StockWarning,
} from "./inventory";

// Documents: PROFORMA, INVOICE, GOODS_ISSUE.
// Lifecycle: DRAFT (editable, deletable) -> ISSUED (locked) -> CANCELLED.
// Conversions copy an issued document into a new draft of the next type:
// PROFORMA -> INVOICE -> GOODS_ISSUE, linked through source_document_id.
// Issuing a goods issue books its products out of stock; cancelling puts them back.
export const documentsRouter = Router();
documentsRouter.use((_req, res, next) => {
  const json = res.json.bind(res);
  res.json = ((body: any) => {
    const redact = (doc: any) => {
      if (!doc || !doc.type || !doc.items) return doc;
      return { ...doc, source: doc.source && canRead(res, doc.source.type) ? doc.source : null,
        derived: (doc.derived ?? []).filter((link: any) => canRead(res, link.type)) };
    };
    return json(Array.isArray(body) ? body.map(redact) : body?.rows ? { ...body, rows: body.rows.map(redact) } : redact(body));
  }) as typeof res.json;
  next();
});

const DOCUMENT_TYPES = ["PROFORMA", "INVOICE", "GOODS_ISSUE"] as const;
type DocType = (typeof DOCUMENT_TYPES)[number];

const STARTING_NUMBER: Record<DocType, number> = {
  PROFORMA: 11843,
  INVOICE: 2040,
  GOODS_ISSUE: 2041,
};

const NEXT_TYPE: Partial<Record<DocType, DocType>> = { PROFORMA: "INVOICE", INVOICE: "GOODS_ISSUE" };

const currentUser = (res: Response) => res.locals.user as AuthUser;
const canWrite = (res: Response, type: DocType) => can(currentUser(res), type.toLowerCase() as Module, true);
const canRead = (res: Response, type: DocType) => can(currentUser(res), type.toLowerCase() as Module);
const allowedTypes = (res: Response) => DOCUMENT_TYPES.filter((type) => canRead(res, type));
const forbidden = (res: Response) => res.status(403).json({ error: "Not allowed for your role" });

// Numbers are max+1 per type. The advisory lock (released at commit) makes
// concurrent creates of the same type wait instead of colliding.
async function nextDocumentNumber(client: PoolClient, type: DocType) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`documents:number:${type}`]);
  const r = await client.query<{ n: number | null }>("SELECT max(number) AS n FROM documents WHERE type = $1", [type]);
  const last = r.rows[0]?.n;
  return last ? last + 1 : STARTING_NUMBER[type];
}

function rowToCustomer(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    customerCode: r.customer_code,
    partyKind: r.party_kind ?? "CUSTOMER",
    nationalId: r.national_id,
    economicCode: r.economic_code,
    registration: r.registration,
    province: r.province,
    city: r.city,
    address: r.address,
    postalCode: r.postal_code,
    phone: r.phone,
    fax: r.fax,
  };
}

function rowToItem(r: any) {
  return {
    id: r.id,
    productId: r.product_id,
    name: r.name,
    spec: r.spec,
    unit: r.unit,
    quantity: Number(r.quantity),
    unitPrice: r.unit_price,
    discount: r.discount,
    taxRate: r.tax_rate,
  };
}

const rowToLink = (r: any) => (r ? { id: r.id, type: r.type, number: r.number, status: r.status } : null);

// pg returns `date` columns as a local-midnight Date; send the calendar day.
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const byId = (rows: any[]) => new Map(rows.map((r) => [r.id, r]));
const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))];

// Loads many documents with a fixed number of queries (not five per document),
// returned in the order of `ids`.
async function loadDocuments(ids: string[]) {
  if (ids.length === 0) return [];
  const docs = await query(
    `SELECT d.*, cu.full_name AS created_by_name, iu.full_name AS issued_by_name, xu.full_name AS cancelled_by_name
     FROM documents d
     LEFT JOIN users cu ON cu.id = d.created_by
     LEFT JOIN users iu ON iu.id = d.issued_by
     LEFT JOIN users xu ON xu.id = d.cancelled_by
     WHERE d.id = ANY($1)`,
    [ids]
  );
  const companyIds = distinct(docs.map((d) => d.company_id));
  const customerIds = distinct(docs.map((d) => d.customer_id));
  const sourceIds = distinct(docs.map((d) => d.source_document_id));

  const [companies, customers, itemRows, sources, derivedRows] = await Promise.all([
    companyIds.length ? query("SELECT * FROM companies WHERE id = ANY($1)", [companyIds]) : [],
    customerIds.length ? query("SELECT * FROM customers WHERE id = ANY($1)", [customerIds]) : [],
    query("SELECT * FROM document_items WHERE document_id = ANY($1) ORDER BY row_no ASC", [ids]),
    sourceIds.length ? query("SELECT id, type, number, status FROM documents WHERE id = ANY($1)", [sourceIds]) : [],
    query(
      "SELECT id, type, number, status, source_document_id FROM documents WHERE source_document_id = ANY($1) ORDER BY created_at",
      [ids]
    ),
  ]);

  // Money received against each invoice (routes/payments.ts): active receipts,
  // minus cheques that bounced.
  const paidRows = await query(
    `SELECT document_id, sum(amount) AS paid FROM payments
     WHERE document_id = ANY($1) AND status = 'ACTIVE' AND COALESCE(cheque_status, '') <> 'BOUNCED'
     GROUP BY document_id`,
    [ids]
  );
  const paidByDoc = new Map(paidRows.map((r: any) => [r.document_id, Number(r.paid)]));
  const revisionRows = await query("SELECT id, type, number, status, revision_of_id FROM documents WHERE revision_of_id = ANY($1) ORDER BY created_at", [ids]);
  const companyById = byId(companies);
  const customerById = byId(customers);
  const sourceById = byId(sources);
  const itemsByDoc = new Map<string, any[]>();
  for (const r of itemRows) {
    const list = itemsByDoc.get(r.document_id) ?? [];
    list.push(rowToItem(r));
    itemsByDoc.set(r.document_id, list);
  }
  const derivedByDoc = new Map<string, any[]>();
  for (const r of derivedRows) {
    const list = derivedByDoc.get(r.source_document_id) ?? [];
    list.push(rowToLink(r));
    derivedByDoc.set(r.source_document_id, list);
  }

  const docById = byId(docs);
  return ids
    .map((id) => docById.get(id))
    .filter(Boolean)
    .map((doc) => {
      const items = itemsByDoc.get(doc.id) ?? [];
      return {
        id: doc.id,
        revisionOfId: doc.revision_of_id ?? null,
        revisions: revisionRows.filter((r) => r.revision_of_id === doc.id).map(rowToLink),
        type: doc.type,
        number: doc.number,
        status: doc.status,
        issueDate: doc.issue_date,
        company: rowToCompany(companyById.get(doc.company_id)),
        customer: rowToCustomer(customerById.get(doc.customer_id)),
        buyerName: doc.buyer_name,
        buyerNationalId: doc.buyer_national_id,
        buyerEconomicCode: doc.buyer_economic_code,
        buyerProvince: doc.buyer_province,
        buyerCity: doc.buyer_city,
        buyerAddress: doc.buyer_address,
        buyerPostalCode: doc.buyer_postal_code,
        buyerPhone: doc.buyer_phone,
        relatedInvoiceNo: doc.related_invoice_no,
        vehiclePlate: doc.vehicle_plate,
        vehicleColor: doc.vehicle_color,
        deliveredToName: doc.delivered_to_name,
        deliveredToNationalId: doc.delivered_to_national_id,
        notes: doc.notes,
        validUntil: doc.valid_until ? isoDay(doc.valid_until) : null,
        paidAmount: paidByDoc.get(doc.id) ?? 0,
        items,
        totals: computeDocumentTotals(
          items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate }))
        ),
        createdByName: doc.created_by_name,
        updatedAt: doc.updated_at,
        issuedAt: doc.issued_at,
        issuedByName: doc.issued_by_name,
        cancelledAt: doc.cancelled_at,
        cancelledByName: doc.cancelled_by_name,
        cancelReason: doc.cancel_reason,
        source: rowToLink(sourceById.get(doc.source_document_id)),
        derived: derivedByDoc.get(doc.id) ?? [],
      };
    });
}

async function loadDocument(id: string) {
  const [doc] = await loadDocuments([id]);
  return doc ?? null;
}

const itemSchema = z.object({
  productId: z.string().optional().nullable(),
  name: z.string().min(1),
  spec: z.string().optional().nullable(),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().int().nonnegative(),
  discount: z.number().int().nonnegative().optional(),
  taxRate: z.number().int().min(0).max(100).optional(),
});

// Status is not accepted here: it only changes through /issue and /cancel.
const documentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  issueDate: z.string().optional(),
  customerId: z.string().optional().nullable(),
  buyerName: z.string().optional().nullable(),
  buyerNationalId: z.string().optional().nullable(),
  buyerEconomicCode: z.string().optional().nullable(),
  buyerProvince: z.string().optional().nullable(),
  buyerCity: z.string().optional().nullable(),
  buyerAddress: z.string().optional().nullable(),
  buyerPostalCode: z.string().optional().nullable(),
  buyerPhone: z.string().optional().nullable(),
  relatedInvoiceNo: z.string().optional().nullable(),
  vehiclePlate: z.string().optional().nullable(),
  vehicleColor: z.string().optional().nullable(),
  deliveredToName: z.string().optional().nullable(),
  deliveredToNationalId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  validUntil: z.string().date().optional().nullable(),
  items: z.array(itemSchema).min(1),
  // The `updatedAt` the client loaded, so a save made against a document that
  // someone else has since changed is rejected instead of silently
  // overwriting their edit (PUT only; ignored elsewhere).
  expectedUpdatedAt: z.iso.datetime().optional(),
});

type ItemInput = z.infer<typeof itemSchema>;

async function insertItems(client: PoolClient, documentId: string, items: ItemInput[]) {
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    await client.query(
      `INSERT INTO document_items (id, document_id, product_id, row_no, name, spec, unit, quantity, unit_price, discount, tax_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        newId("item"),
        documentId,
        item.productId ?? null,
        idx + 1,
        item.name,
        item.spec ?? null,
        item.unit,
        item.quantity,
        item.unitPrice,
        item.discount ?? 0,
        item.taxRate ?? 0,
      ]
    );
  }
}

const totalsFor = (items: ItemInput[]) =>
  computeDocumentTotals(
    items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate }))
  );

// GET /api/documents?type=&customerId=
documentsRouter.get("/", async (req, res, next) => {
  try {
    const { type, customerId, since } = z
      .object({ type: z.string().optional(), customerId: z.string().optional(), since: z.string().date().optional() })
      .parse(req.query);
    const conditions: string[] = ["type = ANY($1::text[])"];
    const params: unknown[] = [allowedTypes(res)];
    if (type && !allowedTypes(res).includes(type as DocType)) return forbidden(res);
    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (customerId) {
      params.push(customerId);
      conditions.push(`customer_id = $${params.length}`);
    }
    // The dashboard only needs recent documents, plus drafts of any age
    // (they are still someone's open work).
    if (since) {
      params.push(since);
      conditions.push(`(issue_date >= $${params.length}::date OR status = 'DRAFT')`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const ids = await query<{ id: string }>(
      `SELECT id FROM documents ${where} ORDER BY ${type ? "" : "type ASC, "}number DESC`,
      params
    );
    res.json(await loadDocuments(ids.map((r) => r.id)));
  } catch (err) {
    next(err);
  }
});

// Bounded list for the UI. Existing list consumers remain compatible.
documentsRouter.get("/page", async (req, res, next) => {
  try {
    const input = z.object({
      type: z.enum(DOCUMENT_TYPES).optional(),
      customerId: z.string().max(100).optional(),
      status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]).optional(),
      q: z.string().max(200).optional(),
      from: z.string().date().optional(),
      to: z.string().date().optional(),
      page: z.coerce.number().int().min(1).max(1000000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }).parse(req.query);
    const conditions: string[] = [];
    const values: unknown[] = [];
    const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
    conditions.push(`d.type=ANY(${bind(allowedTypes(res))}::text[])`);
    if (input.type && !canRead(res, input.type)) return forbidden(res);
    if (input.type) conditions.push(`d.type=${bind(input.type)}`);
    if (input.customerId) conditions.push(`d.customer_id=${bind(input.customerId)}`);
    if (input.status) conditions.push(`d.status=${bind(input.status)}`);
    if (input.from) conditions.push(`(d.issue_date AT TIME ZONE 'Asia/Tehran')::date>=${bind(input.from)}::date`);
    if (input.to) conditions.push(`(d.issue_date AT TIME ZONE 'Asia/Tehran')::date<=${bind(input.to)}::date`);
    if (input.from && input.to && input.from > input.to) return res.status(400).json({ error: "Invalid date range" });
    const normalize = (text: string) => text.replace(/[يى]/g, "ی").replace(/ك/g, "ک")
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/‌/g, " ").toLowerCase().trim();
    const haystack = "translate(lower(concat_ws(' ', d.number::text, d.buyer_name, c.name)), 'يىك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩‌', 'ییک01234567890123456789 ')";
    for (const word of normalize(input.q ?? "").split(/\s+/).filter(Boolean)) conditions.push(`position(${bind(word)} in ${haystack})>0`);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await queryOne<{ total: number }>(`SELECT count(*)::int AS total FROM documents d LEFT JOIN customers c ON c.id=d.customer_id ${where}`, values);
    const total = count?.total ?? 0;
    const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
    const ids = await query<{ id: string }>(`SELECT d.id FROM documents d LEFT JOIN customers c ON c.id=d.customer_id ${where} ORDER BY d.issue_date DESC, d.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, input.pageSize, (page - 1) * input.pageSize]);
    res.json({ rows: await loadDocuments(ids.map((r) => r.id)), total, page, pageSize: input.pageSize });
  } catch (err) { next(err); }
});

// Seller metadata needed to compose an authorized document, separate from settings access.
documentsRouter.get("/company", async (_req, res, next) => {
  try {
    if (!allowedTypes(res).length) return forbidden(res);
    res.json(rowToCompany(await currentCompany()));
  } catch (err) { next(err); }
});

documentsRouter.get("/:id", async (req, res, next) => {
  try {
    const doc = await loadDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!canRead(res, doc.type)) return forbidden(res);
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

documentsRouter.post("/", async (req, res, next) => {
  try {
    const data = documentSchema.parse(req.body);
    if (!canWrite(res, data.type)) return forbidden(res);
    const company = await currentCompany();
    const totals = totalsFor(data.items);

    const id = await withTransaction(async (client) => {
      const docId = newId("doc");
      const number = await nextDocumentNumber(client, data.type);
      await client.query(
        `INSERT INTO documents (id, type, number, status, issue_date, company_id, customer_id,
          buyer_name, buyer_national_id, buyer_economic_code, buyer_province, buyer_city, buyer_address,
          buyer_postal_code, buyer_phone, related_invoice_no, vehicle_plate, vehicle_color,
          delivered_to_name, delivered_to_national_id, notes, discount_total, tax_total, created_by, valid_until)
         VALUES ($1,$2,$3,'DRAFT',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
        [
          docId,
          data.type,
          number,
          data.issueDate ? new Date(data.issueDate) : new Date(),
          company?.id ?? null,
          data.customerId ?? null,
          data.buyerName ?? null,
          data.buyerNationalId ?? null,
          data.buyerEconomicCode ?? null,
          data.buyerProvince ?? null,
          data.buyerCity ?? null,
          data.buyerAddress ?? null,
          data.buyerPostalCode ?? null,
          data.buyerPhone ?? null,
          data.relatedInvoiceNo ?? null,
          data.vehiclePlate ?? null,
          data.vehicleColor ?? null,
          data.deliveredToName ?? null,
          data.deliveredToNationalId ?? null,
          data.notes ?? null,
          totals.discountTotal,
          totals.taxTotal,
          currentUser(res).id,
          data.type === "PROFORMA" ? data.validUntil ?? null : null,
        ]
      );
      await insertItems(client, docId, data.items);
      return docId;
    });

    res.status(201).json(await loadDocument(id));
  } catch (err) {
    next(err);
  }
});

documentsRouter.put("/:id", async (req, res, next) => {
  try {
    const data = documentSchema.partial({ type: true, items: true }).parse(req.body);
    const existing = await queryOne("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Document not found" });
    if (!canWrite(res, existing.type)) return forbidden(res);
    if (existing.status !== "DRAFT") return res.status(409).json({ error: "Only draft documents can be edited" });

    const totals = data.items ? totalsFor(data.items) : null;
    const pick = <T,>(value: T | undefined, current: T) => (value !== undefined ? value : current);

    // "not-draft": someone issued/cancelled it after `existing` was read above.
    // "conflict": someone else's edit landed after the browser loaded this
    // document, so applying this save would silently discard theirs.
    const result = await withTransaction<"ok" | "not-draft" | "conflict">(async (client) => {
      const locked = await lockDocument(client, req.params.id);
      if (!locked || locked.status !== "DRAFT") return "not-draft";
      if (data.expectedUpdatedAt && new Date(data.expectedUpdatedAt).getTime() !== new Date(locked.updated_at).getTime()) {
        return "conflict";
      }

      await client.query(
        `UPDATE documents SET issue_date=$1, customer_id=$2, buyer_name=$3, buyer_national_id=$4,
          buyer_economic_code=$5, buyer_province=$6, buyer_city=$7, buyer_address=$8, buyer_postal_code=$9,
          buyer_phone=$10, related_invoice_no=$11, vehicle_plate=$12, vehicle_color=$13, delivered_to_name=$14,
          delivered_to_national_id=$15, notes=$16, discount_total=$17, tax_total=$18, valid_until=$20, updated_at=now()
         WHERE id=$19`,
        [
          data.issueDate ? new Date(data.issueDate) : locked.issue_date,
          pick(data.customerId, locked.customer_id),
          pick(data.buyerName, locked.buyer_name),
          pick(data.buyerNationalId, locked.buyer_national_id),
          pick(data.buyerEconomicCode, locked.buyer_economic_code),
          pick(data.buyerProvince, locked.buyer_province),
          pick(data.buyerCity, locked.buyer_city),
          pick(data.buyerAddress, locked.buyer_address),
          pick(data.buyerPostalCode, locked.buyer_postal_code),
          pick(data.buyerPhone, locked.buyer_phone),
          pick(data.relatedInvoiceNo, locked.related_invoice_no),
          pick(data.vehiclePlate, locked.vehicle_plate),
          pick(data.vehicleColor, locked.vehicle_color),
          pick(data.deliveredToName, locked.delivered_to_name),
          pick(data.deliveredToNationalId, locked.delivered_to_national_id),
          pick(data.notes, locked.notes),
          totals ? totals.discountTotal : locked.discount_total,
          totals ? totals.taxTotal : locked.tax_total,
          req.params.id,
          locked.type === "PROFORMA" ? pick(data.validUntil, locked.valid_until) : null,
        ]
      );
      if (data.items) {
        await client.query("DELETE FROM document_items WHERE document_id = $1", [req.params.id]);
        await insertItems(client, req.params.id, data.items);
      }
      return "ok";
    });

    if (result === "not-draft") return res.status(409).json({ error: "Only draft documents can be edited" });
    if (result === "conflict") {
      return res.status(409).json({ error: "This document was changed by someone else; reload it before saving again" });
    }

    res.json(await loadDocument(req.params.id));
  } catch (err) {
    next(err);
  }
});

// Locks the document row and re-reads it inside the transaction, so two
// simultaneous writes to the same document (issue vs. edit, cancel vs.
// convert, two edits) serialize instead of one silently clobbering the
// other. Whoever's transaction commits first is the one the loser sees.
async function lockDocument(client: PoolClient, id: string) {
  const r = await client.query("SELECT * FROM documents WHERE id = $1 FOR UPDATE", [id]);
  return r.rows[0] ?? null;
}

// DRAFT -> ISSUED. The document date becomes the issue date, and it's locked from now on.
// A goods issue is booked out of stock even when stock is short (stock may go
// negative); the shortfalls come back as `stockWarnings`.
documentsRouter.post("/:id/issue", async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Document not found" });
    if (!canWrite(res, existing.type)) return forbidden(res);
    if (existing.status !== "DRAFT") return res.status(409).json({ error: "Only draft documents can be issued" });
    const items = await queryOne<{ n: number }>(
      "SELECT count(*)::int AS n FROM document_items WHERE document_id = $1",
      [req.params.id]
    );
    if (!items?.n) return res.status(400).json({ error: "A document needs at least one item" });

    const userId = currentUser(res).id;
    const stockWarnings = await withTransaction<StockWarning[] | null>(async (client) => {
      const locked = await lockDocument(client, req.params.id);
      if (!locked || locked.status !== "DRAFT") return null;
      let warnings: StockWarning[] = [];
      if (existing.type === "GOODS_ISSUE") {
        warnings = await stockShortfalls(req.params.id, client);
        await postGoodsIssueMovements(client, req.params.id, userId);
      }
      await client.query(
        `UPDATE documents SET status='ISSUED', issued_at=now(), issued_by=$2, issue_date=now(), updated_at=now()
         WHERE id=$1`,
        [req.params.id, userId]
      );
      return warnings;
    });
    if (stockWarnings === null) return res.status(409).json({ error: "Only draft documents can be issued" });

    res.json({ ...(await loadDocument(req.params.id)), stockWarnings });
  } catch (err) {
    next(err);
  }
});

// ISSUED -> CANCELLED (issued documents are never deleted). Drafts are deleted instead.
documentsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(req.body ?? {});
    const existing = await queryOne("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Document not found" });
    if (!canWrite(res, existing.type)) return forbidden(res);
    if (existing.status !== "ISSUED") return res.status(409).json({ error: "Only issued documents can be cancelled" });

    const userId = currentUser(res).id;
    // "not-issued": raced with something that already moved it off ISSUED.
    // "blocked": raced with (or lost to) a /convert of this same document —
    // /convert takes this same row lock, so only one of the two can win.
    const result = await withTransaction<"ok" | "not-issued" | "has-payments" | { blocking: unknown }>(async (client) => {
      const locked = await lockDocument(client, req.params.id);
      if (!locked || locked.status !== "ISSUED") return "not-issued";

      const active = await client.query(
        "SELECT id, type, number FROM documents WHERE source_document_id = $1 AND status <> 'CANCELLED' LIMIT 1",
        [req.params.id]
      );
      if (active.rows[0]) return { blocking: rowToLink(active.rows[0]) };
      // Money received against an invoice has to be cancelled (or moved) first,
      // or the customer's balance would count a payment for nothing.
      const paid = await client.query(
        "SELECT 1 FROM payments WHERE document_id = $1 AND status = 'ACTIVE' LIMIT 1",
        [req.params.id]
      );
      if (paid.rows[0]) return "has-payments";

      if (existing.type === "GOODS_ISSUE") await reverseGoodsIssueMovements(client, req.params.id, userId);
      await client.query(
        `UPDATE documents SET status='CANCELLED', cancelled_at=now(), cancelled_by=$2, cancel_reason=$3, updated_at=now()
         WHERE id=$1`,
        [req.params.id, userId, reason || null]
      );
      return "ok";
    });

    if (result === "not-issued") return res.status(409).json({ error: "Only issued documents can be cancelled" });
    if (result === "has-payments") {
      return res.status(409).json({ error: "Cancel the payments recorded against this invoice first" });
    }
    if (result !== "ok") {
      return res.status(409).json({ error: "Cancel the documents created from this one first", blocking: result.blocking });
    }

    res.json(await loadDocument(req.params.id));
  } catch (err) {
    next(err);
  }
});

// Copy an issued document into a new draft of the next type (items, buyer, customer).
documentsRouter.post("/:id/convert", async (req, res, next) => {
  try {
    const { to } = z.object({ to: z.enum(DOCUMENT_TYPES) }).parse(req.body);
    const source = await queryOne("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!source) return res.status(404).json({ error: "Document not found" });
    if (NEXT_TYPE[source.type as DocType] !== to) {
      return res.status(400).json({ error: `A ${source.type} can't be converted to ${to}` });
    }
    if (!canWrite(res, to) || !canRead(res, source.type)) return forbidden(res);

    // "not-issued": re-checked after taking the lock below — covers both this
    // pre-check and a concurrent /cancel of the same source, which takes the
    // same row lock. "existing": already converted, including by a request
    // that raced this one and won.
    const outcome = await withTransaction<
      { kind: "ok"; id: string } | { kind: "not-issued" } | { kind: "existing"; existing: unknown }
    >(async (client) => {
      const locked = await lockDocument(client, source.id);
      if (!locked || locked.status !== "ISSUED") return { kind: "not-issued" };

      const dup = await client.query(
        "SELECT id, type, number, status FROM documents WHERE source_document_id=$1 AND type=$2 AND status <> 'CANCELLED' LIMIT 1",
        [locked.id, to]
      );
      if (dup.rows[0]) return { kind: "existing", existing: rowToLink(dup.rows[0]) };

      const itemRows = await client.query("SELECT * FROM document_items WHERE document_id = $1 ORDER BY row_no", [
        locked.id,
      ]);
      const items: ItemInput[] = itemRows.rows.map((r: any) => ({
        productId: r.product_id,
        name: r.name,
        spec: r.spec,
        unit: r.unit,
        quantity: Number(r.quantity),
        unitPrice: r.unit_price,
        discount: r.discount,
        taxRate: r.tax_rate,
      }));
      const totals = totalsFor(items);

      const docId = newId("doc");
      const number = await nextDocumentNumber(client, to);
      await client.query(
        `INSERT INTO documents (id, type, number, status, issue_date, company_id, customer_id,
          buyer_name, buyer_national_id, buyer_economic_code, buyer_province, buyer_city, buyer_address,
          buyer_postal_code, buyer_phone, related_invoice_no, discount_total, tax_total, created_by, source_document_id)
         VALUES ($1,$2,$3,'DRAFT',now(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          docId,
          to,
          number,
          locked.company_id,
          locked.customer_id,
          locked.buyer_name,
          locked.buyer_national_id,
          locked.buyer_economic_code,
          locked.buyer_province,
          locked.buyer_city,
          locked.buyer_address,
          locked.buyer_postal_code,
          locked.buyer_phone,
          // A goods issue refers to the invoice it ships.
          locked.type === "INVOICE" ? String(locked.number) : null,
          totals.discountTotal,
          totals.taxTotal,
          currentUser(res).id,
          locked.id,
        ]
      );
      await insertItems(client, docId, items);
      return { kind: "ok", id: docId };
    });

    if (outcome.kind === "not-issued") return res.status(409).json({ error: "Issue the document before converting it" });
    if (outcome.kind === "existing") return res.status(409).json({ error: "Already converted", existing: outcome.existing });

    res.status(201).json(await loadDocument(outcome.id));
  } catch (err) {
    next(err);
  }
});

// An issued quote remains immutable. Editing starts a linked draft with its own number.
documentsRouter.post("/:id/revise", async (req, res, next) => {
  try {
    if (!canWrite(res, "PROFORMA")) return forbidden(res);
    const outcome = await withTransaction(async (client) => {
      const source = await lockDocument(client, req.params.id);
      if (!source) return { error: 404 };
      if (source.type !== "PROFORMA" || source.status !== "ISSUED") return { error: 409 };
      // Retried requests reopen the same draft instead of generating duplicates.
      const existing = await client.query("SELECT id FROM documents WHERE revision_of_id=$1 AND status='DRAFT'", [source.id]);
      if (existing.rows[0]) return { id: existing.rows[0].id };
      const id = newId("doc");
      const number = await nextDocumentNumber(client, "PROFORMA");
      const fields = ["company_id", "customer_id", "buyer_name", "buyer_national_id", "buyer_economic_code", "buyer_province", "buyer_city", "buyer_address", "buyer_postal_code", "buyer_phone", "notes", "discount_total", "tax_total"];
      await client.query(`INSERT INTO documents (id,type,number,status,issue_date,created_by,revision_of_id,${fields.join(",")}) VALUES ($1,'PROFORMA',$2,'DRAFT',now(),$3,$4,${fields.map((_, i) => "$" + (i + 5)).join(",")})`, [id, number, currentUser(res).id, source.id, ...fields.map((field) => source[field])]);
      const items = await client.query("SELECT * FROM document_items WHERE document_id=$1 ORDER BY row_no", [source.id]);
      await insertItems(client, id, items.rows.map(rowToItem));
      return { id };
    });
    if (outcome.error) return res.status(outcome.error).json({ error: "Only issued proformas can be revised" });
    res.status(201).json(await loadDocument(outcome.id!));
  } catch (err) { next(err); }
});

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Document not found" });
    if (!canWrite(res, existing.type)) return forbidden(res);
    // The status check and the delete are one statement, so a concurrent
    // /issue can't land between them and get its document deleted out from
    // under it: whichever commits first is the one that "wins".
    const deleted = await query<{ id: string }>("DELETE FROM documents WHERE id = $1 AND status = 'DRAFT' RETURNING id", [
      req.params.id,
    ]);
    if (!deleted.length) {
      return res.status(409).json({ error: "Only drafts can be deleted; cancel issued documents instead" });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
