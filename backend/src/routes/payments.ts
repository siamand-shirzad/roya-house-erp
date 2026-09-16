import { Router, type Response } from "express";
import { z } from "zod";
import type { AuthUser } from "../lib/auth";
import { newId, query, queryOne, withTransaction } from "../lib/db";
import { requirePermission } from "../lib/permissions";

// Payments received (رسید دریافت, as in Sepidar): cash, card, bank transfer or
// cheque, optionally against one invoice. Never deleted — a wrong receipt is
// cancelled. A cheque counts towards the customer's balance while PENDING or
// CLEARED and stops counting when it BOUNCES.
//
// Balance per customer = issued invoices − counted payments. Invoices typed
// without a customer (buyer name only) have no balance to belong to.
export const paymentsRouter = Router();
paymentsRouter.use(requirePermission("payments"));

const METHODS = ["CASH", "CARD", "TRANSFER", "CHEQUE"] as const;
const CHEQUE_STATUSES = ["PENDING", "CLEARED", "BOUNCED"] as const;
const STARTING_NUMBER = 1001;

const currentUser = (res: Response) => res.locals.user as AuthUser;

// SQL for "this payment counts towards the balance".
export const COUNTED = "p.status = 'ACTIVE' AND COALESCE(p.cheque_status, '') <> 'BOUNCED'";

// Sum of issued invoices per customer, same line formula as lib/totals.ts.
const INVOICED_SQL = `
  SELECT d.customer_id,
         sum(round(i.quantity * i.unit_price) - i.discount
             + round((round(i.quantity * i.unit_price) - i.discount) * i.tax_rate / 100.0)) AS invoiced
    FROM documents d JOIN document_items i ON i.document_id = d.id
   WHERE d.type = 'INVOICE' AND d.status = 'ISSUED' AND d.customer_id IS NOT NULL
   GROUP BY d.customer_id`;

function rowToPayment(r: any) {
  return {
    id: r.id,
    number: r.number,
    customerId: r.customer_id,
    customerName: r.customer_name ?? null,
    document: r.document_id ? { id: r.document_id, number: r.document_number, status: r.document_status } : null,
    payerName: r.payer_name,
    method: r.method,
    amount: r.amount,
    paidAt: r.paid_at_iso,
    reference: r.reference,
    chequeNumber: r.cheque_number,
    chequeBank: r.cheque_bank,
    chequeDueDate: r.cheque_due_iso,
    chequeStatus: r.cheque_status,
    notes: r.notes,
    status: r.status,
    cancelReason: r.cancel_reason,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

const SELECT_PAYMENTS = `
  SELECT p.*, to_char(p.paid_at, 'YYYY-MM-DD') AS paid_at_iso, to_char(p.cheque_due_date, 'YYYY-MM-DD') AS cheque_due_iso,
         c.name AS customer_name, d.number AS document_number, d.status AS document_status, u.full_name AS created_by_name
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id
    LEFT JOIN documents d ON d.id = p.document_id
    LEFT JOIN users u ON u.id = p.created_by`;

// GET /api/payments?customerId=&documentId=&method=&chequeStatus=&from=&to=
paymentsRouter.get("/", async (req, res, next) => {
  try {
    const f = z
      .object({
        customerId: z.string().max(100).optional(),
        documentId: z.string().max(100).optional(),
        method: z.enum(METHODS).optional(),
        chequeStatus: z.enum(CHEQUE_STATUSES).optional(),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
      })
      .parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      conditions.push(sql.replace("?", `$${params.length}`));
    };
    if (f.customerId) add("p.customer_id = ?", f.customerId);
    if (f.documentId) add("p.document_id = ?", f.documentId);
    if (f.method) add("p.method = ?", f.method);
    if (f.chequeStatus) add("p.cheque_status = ?", f.chequeStatus);
    if (f.from) add("p.paid_at >= ?::date", f.from);
    if (f.to) add("p.paid_at <= ?::date", f.to);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(`${SELECT_PAYMENTS} ${where} ORDER BY p.paid_at DESC, p.number DESC LIMIT 1000`, params);
    res.json(rows.map(rowToPayment));
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/balances: every customer with invoices or payments.
paymentsRouter.get("/balances", async (_req, res, next) => {
  try {
    const rows = await query(
      `WITH inv AS (${INVOICED_SQL}),
            paid AS (SELECT p.customer_id, sum(p.amount) AS paid FROM payments p
                      WHERE ${COUNTED} AND p.customer_id IS NOT NULL GROUP BY p.customer_id),
            pending AS (SELECT p.customer_id, sum(p.amount) AS pending FROM payments p
                         WHERE p.status = 'ACTIVE' AND p.cheque_status = 'PENDING' GROUP BY p.customer_id)
       SELECT c.id, c.name, c.customer_code, c.phone,
              COALESCE(inv.invoiced, 0) AS invoiced, COALESCE(paid.paid, 0) AS paid,
              COALESCE(pending.pending, 0) AS pending_cheques
         FROM customers c
         LEFT JOIN inv ON inv.customer_id = c.id
         LEFT JOIN paid ON paid.customer_id = c.id
         LEFT JOIN pending ON pending.customer_id = c.id
        WHERE inv.invoiced IS NOT NULL OR paid.paid IS NOT NULL
        ORDER BY COALESCE(inv.invoiced, 0) - COALESCE(paid.paid, 0) DESC, c.name`
    );
    res.json(
      rows.map((r: any) => {
        const invoiced = Number(r.invoiced);
        const paid = Number(r.paid);
        return {
          customerId: r.id,
          name: r.name,
          customerCode: r.customer_code,
          phone: r.phone,
          invoiced,
          paid,
          balance: invoiced - paid,
          pendingCheques: Number(r.pending_cheques),
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

const paymentSchema = z
  .object({
    customerId: z.string().max(100).optional().nullable(),
    documentId: z.string().max(100).optional().nullable(),
    payerName: z.string().trim().max(200).optional().nullable(),
    method: z.enum(METHODS),
    amount: z.number().int().positive().max(1_000_000_000_000),
    paidAt: z.string().date(),
    reference: z.string().trim().max(200).optional().nullable(),
    chequeNumber: z.string().trim().max(50).optional().nullable(),
    chequeBank: z.string().trim().max(100).optional().nullable(),
    chequeDueDate: z.string().date().optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((p) => p.method !== "CHEQUE" || (p.chequeNumber && p.chequeDueDate), {
    message: "A cheque needs its number and due date",
    path: ["chequeNumber"],
  })
  .refine((p) => p.customerId || p.documentId || p.payerName, {
    message: "Say who paid: a customer, an invoice or a payer name",
    path: ["customerId"],
  });

// POST /api/payments
paymentsRouter.post("/", async (req, res, next) => {
  try {
    const data = paymentSchema.parse(req.body);
    let customerId = data.customerId ?? null;
    if (data.documentId) {
      const doc = await queryOne("SELECT type, status, customer_id FROM documents WHERE id = $1", [data.documentId]);
      if (!doc) return res.status(404).json({ error: "Invoice not found" });
      if (doc.type !== "INVOICE" || doc.status !== "ISSUED") {
        return res.status(409).json({ error: "Payments can only be recorded against issued invoices" });
      }
      // The invoice decides whose balance this is.
      if (customerId && doc.customer_id && customerId !== doc.customer_id) {
        return res.status(409).json({ error: "The invoice belongs to another customer" });
      }
      customerId = customerId ?? doc.customer_id;
    }
    const id = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('payments:number'))");
      const r = await client.query<{ n: number | null }>("SELECT max(number) AS n FROM payments");
      const number = r.rows[0]?.n ? r.rows[0].n + 1 : STARTING_NUMBER;
      const pid = newId("pay");
      const cheque = data.method === "CHEQUE";
      await client.query(
        `INSERT INTO payments (id, number, customer_id, document_id, payer_name, method, amount, paid_at, reference,
           cheque_number, cheque_bank, cheque_due_date, cheque_status, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          pid,
          number,
          customerId,
          data.documentId ?? null,
          data.payerName || null,
          data.method,
          data.amount,
          data.paidAt,
          data.reference || null,
          cheque ? data.chequeNumber : null,
          cheque ? data.chequeBank || null : null,
          cheque ? data.chequeDueDate : null,
          cheque ? "PENDING" : null,
          data.notes || null,
          currentUser(res).id,
        ]
      );
      return pid;
    });
    const row = await queryOne(`${SELECT_PAYMENTS} WHERE p.id = $1`, [id]);
    res.status(201).json(rowToPayment(row));
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/cheque-status {status}: a cheque cleared or bounced.
paymentsRouter.post("/:id/cheque-status", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(CHEQUE_STATUSES) }).parse(req.body);
    const row = await queryOne(
      `UPDATE payments SET cheque_status = $2, updated_at = now()
        WHERE id = $1 AND method = 'CHEQUE' AND status = 'ACTIVE' RETURNING id`,
      [req.params.id, status]
    );
    if (!row) return res.status(409).json({ error: "Only an active cheque can change status" });
    res.json(rowToPayment(await queryOne(`${SELECT_PAYMENTS} WHERE p.id = $1`, [req.params.id])));
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/cancel {reason}
paymentsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().min(1).max(500) }).parse(req.body ?? {});
    const row = await queryOne(
      `UPDATE payments SET status = 'CANCELLED', cancel_reason = $2, updated_at = now()
        WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
      [req.params.id, reason]
    );
    if (!row) return res.status(409).json({ error: "Only an active payment can be cancelled" });
    res.json(rowToPayment(await queryOne(`${SELECT_PAYMENTS} WHERE p.id = $1`, [req.params.id])));
  } catch (err) {
    next(err);
  }
});
