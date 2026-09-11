import { Router } from "express";
import { z } from "zod";
import { pool, query, queryOne, newId } from "../lib/db";
import { computeDocumentTotals } from "../lib/totals";

export const documentsRouter = Router();

const DOCUMENT_TYPES = ["PROFORMA", "INVOICE", "GOODS_ISSUE"] as const;

const STARTING_NUMBER: Record<(typeof DOCUMENT_TYPES)[number], number> = {
  PROFORMA: 11843,
  INVOICE: 2040,
  GOODS_ISSUE: 2041,
};

async function nextDocumentNumber(type: (typeof DOCUMENT_TYPES)[number]) {
  const last = await queryOne<{ number: number }>(
    "SELECT number FROM documents WHERE type = $1 ORDER BY number DESC LIMIT 1",
    [type]
  );
  return last ? last.number + 1 : STARTING_NUMBER[type];
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

async function loadDocument(id: string) {
  const doc = await queryOne("SELECT * FROM documents WHERE id = $1", [id]);
  if (!doc) return null;

  const [company, customer, itemRows] = await Promise.all([
    doc.company_id ? queryOne("SELECT * FROM companies WHERE id = $1", [doc.company_id]) : null,
    doc.customer_id ? queryOne("SELECT * FROM customers WHERE id = $1", [doc.customer_id]) : null,
    query("SELECT * FROM document_items WHERE document_id = $1 ORDER BY row_no ASC", [id]),
  ]);

  const items = itemRows.map(rowToItem);
  const totals = computeDocumentTotals(
    items.map((i: any) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRate: i.taxRate,
    }))
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

const documentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]).optional(),
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
  const client = await pool.connect();
  try {
    const data = documentSchema.parse(req.body);
    const number = await nextDocumentNumber(data.type);
    const company = await queryOne("SELECT id FROM companies LIMIT 1");

    const totals = computeDocumentTotals(
      data.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        taxRate: i.taxRate,
      }))
    );

    const id = newId("doc");

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO documents (id, type, number, status, issue_date, company_id, customer_id,
        buyer_name, buyer_national_id, buyer_economic_code, buyer_province, buyer_city, buyer_address,
        buyer_postal_code, buyer_phone, related_invoice_no, vehicle_plate, vehicle_color,
        delivered_to_name, delivered_to_national_id, notes, discount_total, tax_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        id,
        data.type,
        number,
        data.status ?? "DRAFT",
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
      ]
    );

    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx];
      await client.query(
        `INSERT INTO document_items (id, document_id, product_id, row_no, name, spec, unit, quantity, unit_price, discount, tax_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          newId("item"),
          id,
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
    await client.query("COMMIT");

    const doc = await loadDocument(id);
    res.status(201).json(doc);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

documentsRouter.put("/:id", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const data = documentSchema.partial({ type: true, items: true }).parse(req.body);
    const existing = await queryOne("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Document not found" });

    const totals = data.items
      ? computeDocumentTotals(
          data.items.map((i) => ({
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            taxRate: i.taxRate,
          }))
        )
      : null;

    const merged = {
      status: data.status ?? existing.status,
      issueDate: data.issueDate ? new Date(data.issueDate) : existing.issue_date,
      customerId: data.customerId !== undefined ? data.customerId : existing.customer_id,
      buyerName: data.buyerName !== undefined ? data.buyerName : existing.buyer_name,
      buyerNationalId: data.buyerNationalId !== undefined ? data.buyerNationalId : existing.buyer_national_id,
      buyerEconomicCode: data.buyerEconomicCode !== undefined ? data.buyerEconomicCode : existing.buyer_economic_code,
      buyerProvince: data.buyerProvince !== undefined ? data.buyerProvince : existing.buyer_province,
      buyerCity: data.buyerCity !== undefined ? data.buyerCity : existing.buyer_city,
      buyerAddress: data.buyerAddress !== undefined ? data.buyerAddress : existing.buyer_address,
      buyerPostalCode: data.buyerPostalCode !== undefined ? data.buyerPostalCode : existing.buyer_postal_code,
      buyerPhone: data.buyerPhone !== undefined ? data.buyerPhone : existing.buyer_phone,
      relatedInvoiceNo: data.relatedInvoiceNo !== undefined ? data.relatedInvoiceNo : existing.related_invoice_no,
      vehiclePlate: data.vehiclePlate !== undefined ? data.vehiclePlate : existing.vehicle_plate,
      vehicleColor: data.vehicleColor !== undefined ? data.vehicleColor : existing.vehicle_color,
      deliveredToName: data.deliveredToName !== undefined ? data.deliveredToName : existing.delivered_to_name,
      deliveredToNationalId:
        data.deliveredToNationalId !== undefined ? data.deliveredToNationalId : existing.delivered_to_national_id,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      discountTotal: totals ? totals.discountTotal : existing.discount_total,
      taxTotal: totals ? totals.taxTotal : existing.tax_total,
    };

    await client.query("BEGIN");
    await client.query(
      `UPDATE documents SET status=$1, issue_date=$2, customer_id=$3, buyer_name=$4, buyer_national_id=$5,
        buyer_economic_code=$6, buyer_province=$7, buyer_city=$8, buyer_address=$9, buyer_postal_code=$10,
        buyer_phone=$11, related_invoice_no=$12, vehicle_plate=$13, vehicle_color=$14, delivered_to_name=$15,
        delivered_to_national_id=$16, notes=$17, discount_total=$18, tax_total=$19, updated_at=now()
       WHERE id=$20`,
      [
        merged.status,
        merged.issueDate,
        merged.customerId,
        merged.buyerName,
        merged.buyerNationalId,
        merged.buyerEconomicCode,
        merged.buyerProvince,
        merged.buyerCity,
        merged.buyerAddress,
        merged.buyerPostalCode,
        merged.buyerPhone,
        merged.relatedInvoiceNo,
        merged.vehiclePlate,
        merged.vehicleColor,
        merged.deliveredToName,
        merged.deliveredToNationalId,
        merged.notes,
        merged.discountTotal,
        merged.taxTotal,
        req.params.id,
      ]
    );

    if (data.items) {
      await client.query("DELETE FROM document_items WHERE document_id = $1", [req.params.id]);
      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        await client.query(
          `INSERT INTO document_items (id, document_id, product_id, row_no, name, spec, unit, quantity, unit_price, discount, tax_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            newId("item"),
            req.params.id,
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
    await client.query("COMMIT");

    const doc = await loadDocument(req.params.id);
    res.json(doc);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    await query("DELETE FROM documents WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
