import { Router, type Response } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool, query, queryOne, newId } from "../lib/db";
import { computeDocumentTotals } from "../lib/totals";
import type { AuthUser, Role } from "../lib/auth";

// Documents: PROFORMA, INVOICE, GOODS_ISSUE.
// Lifecycle: DRAFT (editable, deletable) -> ISSUED (locked) -> CANCELLED.
// Conversions copy an issued document into a new draft of the next type:
// PROFORMA -> INVOICE -> GOODS_ISSUE, linked through source_document_id.
export const documentsRouter = Router();

const DOCUMENT_TYPES = ["PROFORMA", "INVOICE", "GOODS_ISSUE"] as const;
type DocType = (typeof DOCUMENT_TYPES)[number];

const STARTING_NUMBER: Record<DocType, number> = {
  PROFORMA: 11843,
  INVOICE: 2040,
  GOODS_ISSUE: 2041,
};

// Who may create/edit/issue/cancel/delete each type. Everyone signed in can read.
const WRITE_ROLES: Record<DocType, Role[]> = {
  PROFORMA: ["ADMIN", "SALES"],
  INVOICE: ["ADMIN", "SALES"],
  GOODS_ISSUE: ["ADMIN", "WAREHOUSE"],
};

const NEXT_TYPE: Partial<Record<DocType, DocType>> = { PROFORMA: "INVOICE", INVOICE: "GOODS_ISSUE" };

const currentUser = (res: Response) => res.locals.user as AuthUser;
const canWrite = (res: Response, type: DocType) => WRITE_ROLES[type].includes(currentUser(res).role);
const forbidden = (res: Response) => res.status(403).json({ error: "Not allowed for your role" });

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Numbers are max+1 per type. The advisory lock (released at commit) makes
// concurrent creates of the same type wait instead of colliding.
async function nextDocumentNumber(client: PoolClient, type: DocType) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`documents:number:${type}`]);
  const r = await client.query<{ n: number | null }>("SELECT max(number) AS n FROM documents WHERE type = $1", [type]);
  const last = r.rows[0]?.n;
  return last ? last + 1 : STARTING_NUMBER[type];
}

function rowToCompany(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    legalName: r.legal_name,
    nationalId: r.national_id,
    economicCode: r.economic_code,
    registration: r.registration,
    province: r.province,
    city: r.city,
    address: r.address,
    postalCode: r.postal_code,
    phone: r.phone,
    fax: r.fax,
    logoUrl: r.logo_url,
  };
}

function rowToCustomer(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    customerCode: r.customer_code,
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

async function loadDocument(id: string) {
  const doc = await queryOne(
    `SELECT d.*, cu.full_name AS created_by_name, iu.full_name AS issued_by_name, xu.full_name AS cancelled_by_name
     FROM documents d
     LEFT JOIN users cu ON cu.id = d.created_by
     LEFT JOIN users iu ON iu.id = d.issued_by
     LEFT JOIN users xu ON xu.id = d.cancelled_by
     WHERE d.id = $1`,
    [id]
  );
  if (!doc) return null;

  const [company, customer, itemRows, source, derived] = await Promise.all([
    doc.company_id ? queryOne("SELECT * FROM companies WHERE id = $1", [doc.company_id]) : null,
    doc.customer_id ? queryOne("SELECT * FROM customers WHERE id = $1", [doc.customer_id]) : null,
    query("SELECT * FROM document_items WHERE document_id = $1 ORDER BY row_no ASC", [id]),
    doc.source_document_id
      ? queryOne("SELECT id, type, number, status FROM documents WHERE id = $1", [doc.source_document_id])
      : null,
    query("SELECT id, type, number, status FROM documents WHERE source_document_id = $1 ORDER BY created_at", [id]),
  ]);

  const items = itemRows.map(rowToItem);
  const totals = computeDocumentTotals(
    items.map((i: any) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate }))
  );

  return {
    id: doc.id,
    type: doc.type,
    number: doc.number,
    status: doc.status,
    issueDate: doc.issue_date,
    company: rowToCompany(company),
    customer: rowToCustomer(customer),
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
    items,
    totals,
    createdByName: doc.created_by_name,
    issuedAt: doc.issued_at,
    issuedByName: doc.issued_by_name,
    cancelledAt: doc.cancelled_at,
    cancelledByName: doc.cancelled_by_name,
    cancelReason: doc.cancel_reason,
    source: rowToLink(source),
    derived: derived.map(rowToLink),
  };
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
  items: z.array(itemSchema).min(1),
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

documentsRouter.get("/", async (req, res, next) => {
  try {
    const { type } = req.query as { type?: string };
    const ids = await query<{ id: string }>(
      type
        ? "SELECT id FROM documents WHERE type = $1 ORDER BY number DESC"
        : "SELECT id FROM documents ORDER BY type ASC, number DESC",
      type ? [type] : []
    );
    const docs = await Promise.all(ids.map((r) => loadDocument(r.id)));
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/:id", async (req, res, next) => {
  try {
    const doc = await loadDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

documentsRouter.post("/", async (req, res, next) => {
  try {
    const data = documentSchema.parse(req.body);
    if (!canWrite(res, data.type)) return forbidden(res);
    const company = await queryOne("SELECT id FROM companies LIMIT 1");
    const totals = totalsFor(data.items);

    const id = await withTransaction(async (client) => {
      const docId = newId("doc");
      const number = await nextDocumentNumber(client, data.type);
      await client.query(
        `INSERT INTO documents (id, type, number, status, issue_date, company_id, customer_id,
          buyer_name, buyer_national_id, buyer_economic_code, buyer_province, buyer_city, buyer_address,
          buyer_postal_code, buyer_phone, related_invoice_no, vehicle_plate, vehicle_color,
          delivered_to_name, delivered_to_national_id, notes, discount_total, tax_total, created_by)
         VALUES ($1,$2,$3,'DRAFT',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
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

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE documents SET issue_date=$1, customer_id=$2, buyer_name=$3, buyer_national_id=$4,
          buyer_economic_code=$5, buyer_province=$6, buyer_city=$7, buyer_address=$8, buyer_postal_code=$9,
          buyer_phone=$10, related_invoice_no=$11, vehicle_plate=$12, vehicle_color=$13, delivered_to_name=$14,
          delivered_to_national_id=$15, notes=$16, discount_total=$17, tax_total=$18, updated_at=now()
         WHERE id=$19`,
        [
          data.issueDate ? new Date(data.issueDate) : existing.issue_date,
          pick(data.customerId, existing.customer_id),
          pick(data.buyerName, existing.buyer_name),
          pick(data.buyerNationalId, existing.buyer_national_id),
          pick(data.buyerEconomicCode, existing.buyer_economic_code),
          pick(data.buyerProvince, existing.buyer_province),
          pick(data.buyerCity, existing.buyer_city),
          pick(data.buyerAddress, existing.buyer_address),
          pick(data.buyerPostalCode, existing.buyer_postal_code),
          pick(data.buyerPhone, existing.buyer_phone),
          pick(data.relatedInvoiceNo, existing.related_invoice_no),
          pick(data.vehiclePlate, existing.vehicle_plate),
          pick(data.vehicleColor, existing.vehicle_color),
          pick(data.deliveredToName, existing.delivered_to_name),
          pick(data.deliveredToNationalId, existing.delivered_to_national_id),
          pick(data.notes, existing.notes),
          totals ? totals.discountTotal : existing.discount_total,
          totals ? totals.taxTotal : existing.tax_total,
          req.params.id,
        ]
      );
      if (data.items) {
        await client.query("DELETE FROM document_items WHERE document_id = $1", [req.params.id]);
        await insertItems(client, req.params.id, data.items);
      }
    });

    res.json(await loadDocument(req.params.id));
  } catch (err) {
    next(err);
  }
});

// DRAFT -> ISSUED. The document date becomes the issue date, and it's locked from now on.
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

    await query(
      `UPDATE documents SET status='ISSUED', issued_at=now(), issued_by=$2, issue_date=now(), updated_at=now()
       WHERE id=$1`,
      [req.params.id, currentUser(res).id]
    );
    res.json(await loadDocument(req.params.id));
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

    const active = await queryOne(
      "SELECT id, type, number FROM documents WHERE source_document_id = $1 AND status <> 'CANCELLED' LIMIT 1",
      [req.params.id]
    );
    if (active) {
      return res.status(409).json({ error: "Cancel the documents created from this one first", blocking: rowToLink(active) });
    }

    await query(
      `UPDATE documents SET status='CANCELLED', cancelled_at=now(), cancelled_by=$2, cancel_reason=$3, updated_at=now()
       WHERE id=$1`,
      [req.params.id, currentUser(res).id, reason || null]
    );
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
    if (!canWrite(res, to)) return forbidden(res);
    if (source.status !== "ISSUED") return res.status(409).json({ error: "Issue the document before converting it" });

    const existing = await queryOne(
      "SELECT id, type, number, status FROM documents WHERE source_document_id=$1 AND type=$2 AND status <> 'CANCELLED' LIMIT 1",
      [source.id, to]
    );
    if (existing) return res.status(409).json({ error: "Already converted", existing: rowToLink(existing) });

    const itemRows = await query("SELECT * FROM document_items WHERE document_id = $1 ORDER BY row_no", [source.id]);
    const items: ItemInput[] = itemRows.map((r: any) => ({
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

    const id = await withTransaction(async (client) => {
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
          source.company_id,
          source.customer_id,
          source.buyer_name,
          source.buyer_national_id,
          source.buyer_economic_code,
          source.buyer_province,
          source.buyer_city,
          source.buyer_address,
          source.buyer_postal_code,
          source.buyer_phone,
          // A goods issue refers to the invoice it ships.
          source.type === "INVOICE" ? String(source.number) : null,
          totals.discountTotal,
          totals.taxTotal,
          currentUser(res).id,
          source.id,
        ]
      );
      await insertItems(client, docId, items);
      return docId;
    });

    res.status(201).json(await loadDocument(id));
  } catch (err) {
    next(err);
  }
});

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Document not found" });
    if (!canWrite(res, existing.type)) return forbidden(res);
    if (existing.status !== "DRAFT") {
      return res.status(409).json({ error: "Only drafts can be deleted; cancel issued documents instead" });
    }
    await query("DELETE FROM documents WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
