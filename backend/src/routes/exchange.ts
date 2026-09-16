import { Router, type Response } from "express";
import { z } from "zod";
import type { AuthUser } from "../lib/auth";
import { query } from "../lib/db";
import { jalaliDate, jalaliDay } from "../lib/jalali";
import { can } from "../lib/permissions";
import { COUNTED } from "./payments";

// Data exchange: CSV exports laid out for Sepidar's "import from Excel"
// screens, and a JSON backup of the whole database.
//
// Sepidar conventions followed here: customers and suppliers are one list of
// parties (طرف حساب) identified by a code, goods by their product code,
// dates are Shamsi (1405/06/25), and amounts are in **Rial** — the app stores
// Toman, so every amount is multiplied by 10. Files are UTF-8 with a BOM so
// Excel opens the Persian text correctly; open one in Excel, save it as
// .xlsx, and map the columns in Sepidar's import screen. Column titles follow
// Sepidar's field names but its templates differ between versions, so check
// them against the template of the installed version before the first import.
export const exchangeRouter = Router();

const currentUser = (res: Response) => res.locals.user as AuthUser;
const rial = (toman: unknown) => Math.round(Number(toman ?? 0) * 10);

const PARTY_KIND: Record<string, string> = { CUSTOMER: "مشتری", SUPPLIER: "تأمین‌کننده", BOTH: "مشتری و تأمین‌کننده" };
const METHOD: Record<string, string> = { CASH: "نقد", CARD: "کارتخوان", TRANSFER: "حواله بانکی", CHEQUE: "چک" };
const CHEQUE: Record<string, string> = { PENDING: "در جریان وصول", CLEARED: "وصول‌شده", BOUNCED: "برگشتی" };

function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

function sendCsv(res: Response, name: string, rows: (string | number | null | undefined)[][]) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
  res.send(csv(rows));
}

const rangeSchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional() });
// Documents: issue_date is a timestamp, filtered by Tehran calendar day.
const DOC_RANGE = `($1::date IS NULL OR d.issue_date >= ($1::date)::timestamp AT TIME ZONE 'Asia/Tehran')
  AND ($2::date IS NULL OR d.issue_date < (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Tehran')`;

// Accounting data: whoever may read reports (ADMIN, ACCOUNTANT by default).
exchangeRouter.use("/sepidar", (_req, res, next) => {
  if (!can(currentUser(res), "reports")) return res.status(403).json({ error: "Access to this section is not allowed" });
  next();
});

// GET /api/exchange/sepidar/summary: what is ready and what would be rejected.
exchangeRouter.get("/sepidar/summary", async (_req, res, next) => {
  try {
    const [r] = await query(
      `SELECT (SELECT count(*) FROM customers)::int AS parties,
              (SELECT count(*) FROM customers WHERE COALESCE(trim(customer_code), '') = '')::int AS parties_without_code,
              (SELECT count(*) FROM products WHERE active)::int AS products,
              (SELECT count(*) FROM products WHERE active AND COALESCE(trim(code), '') = '')::int AS products_without_code,
              (SELECT count(*) FROM documents WHERE type = 'INVOICE' AND status = 'ISSUED')::int AS invoices,
              (SELECT count(*) FROM documents WHERE type = 'INVOICE' AND status = 'ISSUED' AND customer_id IS NULL)::int AS invoices_without_party,
              (SELECT count(*) FROM payments WHERE status = 'ACTIVE')::int AS payments`
    );
    res.json({
      parties: r.parties,
      partiesWithoutCode: r.parties_without_code,
      products: r.products,
      productsWithoutCode: r.products_without_code,
      invoices: r.invoices,
      invoicesWithoutParty: r.invoices_without_party,
      payments: r.payments,
    });
  } catch (err) {
    next(err);
  }
});

// طرف حساب‌ها
exchangeRouter.get("/sepidar/parties.csv", async (_req, res, next) => {
  try {
    const rows = await query("SELECT * FROM customers ORDER BY customer_code NULLS LAST, name");
    sendCsv(res, "sepidar-parties", [
      ["کد طرف حساب", "نام", "نوع طرف حساب", "شناسه/کد ملی", "کد اقتصادی", "شماره ثبت", "استان", "شهر", "آدرس", "کد پستی", "تلفن", "فکس"],
      ...rows.map((c: any) => [
        c.customer_code, c.name, PARTY_KIND[c.party_kind] ?? PARTY_KIND.CUSTOMER, c.national_id, c.economic_code,
        c.registration, c.province, c.city, c.address, c.postal_code, c.phone, c.fax,
      ]),
    ]);
  } catch (err) {
    next(err);
  }
});

// کالاها
exchangeRouter.get("/sepidar/products.csv", async (_req, res, next) => {
  try {
    const rows = await query("SELECT * FROM products WHERE active ORDER BY code NULLS LAST, name");
    sendCsv(res, "sepidar-products", [
      ["کد کالا", "نام کالا", "واحد سنجش", "گروه کالا", "مشخصات", "برند", "قیمت فروش (ریال)", "آخرین قیمت خرید (ریال)", "نقطه سفارش"],
      ...rows.map((p: any) => [
        p.code, p.name, p.unit, p.category, p.spec, p.brand, rial(p.unit_price),
        p.cost_price === null ? "" : rial(p.cost_price), p.min_stock === null ? "" : Number(p.min_stock),
      ]),
    ]);
  } catch (err) {
    next(err);
  }
});

// فاکتورهای فروش: one row per line, header fields repeated on every line.
exchangeRouter.get("/sepidar/invoices.csv", async (req, res, next) => {
  try {
    const { from, to } = rangeSchema.parse(req.query);
    const rows = await query(
      `SELECT d.number, d.issue_date, c.customer_code, COALESCE(NULLIF(trim(d.buyer_name), ''), c.name) AS buyer,
              d.buyer_economic_code, d.buyer_national_id, i.row_no, p.code AS product_code, i.name, i.spec, i.unit,
              i.quantity, i.unit_price, i.discount, i.tax_rate
         FROM documents d
         JOIN document_items i ON i.document_id = d.id
         LEFT JOIN customers c ON c.id = d.customer_id
         LEFT JOIN products p ON p.id = i.product_id
        WHERE d.type = 'INVOICE' AND d.status = 'ISSUED' AND ${DOC_RANGE}
        ORDER BY d.number, i.row_no`,
      [from ?? null, to ?? null]
    );
    sendCsv(res, "sepidar-sales-invoices", [
      ["شماره فاکتور", "تاریخ", "کد طرف حساب", "نام خریدار", "کد اقتصادی خریدار", "شناسه ملی خریدار", "ردیف",
        "کد کالا", "شرح کالا", "واحد", "مقدار", "فی (ریال)", "مبلغ (ریال)", "تخفیف (ریال)", "مالیات و عوارض (ریال)", "مبلغ کل (ریال)"],
      ...rows.map((r: any) => {
        const line = Math.round(Number(r.quantity) * r.unit_price);
        const after = line - r.discount;
        const tax = Math.round((after * r.tax_rate) / 100);
        return [
          r.number, jalaliDate(r.issue_date), r.customer_code, r.buyer, r.buyer_economic_code, r.buyer_national_id,
          r.row_no, r.product_code, r.spec ? `${r.name} - ${r.spec}` : r.name, r.unit, Number(r.quantity),
          rial(r.unit_price), rial(line), rial(r.discount), rial(tax), rial(after + tax),
        ];
      }),
    ]);
  } catch (err) {
    next(err);
  }
});

// رسیدهای دریافت
exchangeRouter.get("/sepidar/payments.csv", async (req, res, next) => {
  try {
    const { from, to } = rangeSchema.parse(req.query);
    const rows = await query(
      `SELECT p.*, to_char(p.paid_at, 'YYYY-MM-DD') AS paid_iso, to_char(p.cheque_due_date, 'YYYY-MM-DD') AS due_iso,
              c.customer_code, c.name AS customer_name, d.number AS invoice_number
         FROM payments p
         LEFT JOIN customers c ON c.id = p.customer_id
         LEFT JOIN documents d ON d.id = p.document_id
        WHERE ${COUNTED}
          AND ($1::date IS NULL OR p.paid_at >= $1::date) AND ($2::date IS NULL OR p.paid_at <= $2::date)
        ORDER BY p.paid_at, p.number`,
      [from ?? null, to ?? null]
    );
    sendCsv(res, "sepidar-receipts", [
      ["شماره رسید", "تاریخ", "کد طرف حساب", "نام پرداخت‌کننده", "نوع دریافت", "مبلغ (ریال)", "شماره فاکتور",
        "شماره چک", "بانک", "تاریخ سررسید", "وضعیت چک", "شماره پیگیری", "شرح"],
      ...rows.map((p: any) => [
        p.number, jalaliDay(p.paid_iso), p.customer_code, p.customer_name ?? p.payer_name, METHOD[p.method], rial(p.amount),
        p.invoice_number, p.cheque_number, p.cheque_bank, jalaliDay(p.due_iso), p.cheque_status ? CHEQUE[p.cheque_status] : "",
        p.reference, p.notes,
      ]),
    ]);
  } catch (err) {
    next(err);
  }
});

// رسید و حواله انبار: receipts (with supplier and cost) and goods issues.
exchangeRouter.get("/sepidar/stock.csv", async (req, res, next) => {
  try {
    const { from, to } = rangeSchema.parse(req.query);
    const rows = await query(
      `SELECT m.*, p.code AS product_code, p.name AS product_name, p.unit, s.customer_code AS supplier_code,
              s.name AS supplier_name, d.number AS document_number, d.related_invoice_no
         FROM stock_movements m
         JOIN products p ON p.id = m.product_id
         LEFT JOIN customers s ON s.id = m.supplier_id
         LEFT JOIN documents d ON d.id = m.document_id
        WHERE ($1::date IS NULL OR m.created_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Tehran')
          AND ($2::date IS NULL OR m.created_at < (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Tehran')
        ORDER BY m.created_at`,
      [from ?? null, to ?? null]
    );
    const KIND: Record<string, string> = {
      RECEIPT: "رسید خرید", ISSUE: "حواله فروش", ISSUE_REVERSAL: "برگشت حواله", ADJUSTMENT: "تعدیل انبارگردانی",
    };
    sendCsv(res, "sepidar-stock", [
      ["تاریخ", "نوع", "شماره حواله", "شماره فاکتور مرتبط", "کد کالا", "نام کالا", "واحد", "مقدار", "فی خرید (ریال)",
        "کد تأمین‌کننده", "نام تأمین‌کننده", "مرجع"],
      ...rows.map((m: any) => [
        jalaliDate(m.created_at), KIND[m.kind] ?? m.kind, m.document_number, m.related_invoice_no, m.product_code,
        m.product_name, m.unit, Number(m.quantity), m.unit_cost === null ? "" : rial(m.unit_cost), m.supplier_code,
        m.supplier_name, m.reference,
      ]),
    ]);
  } catch (err) {
    next(err);
  }
});

// GET /api/exchange/backup: every business table as JSON (ADMIN only).
// Password hashes and sessions are left out on purpose, so the file is safe
// to keep on a laptop; after a restore, users set new passwords.
const BACKUP_TABLES = [
  "companies", "customers", "products", "documents", "document_items", "stock_movements", "payments", "users",
] as const;

exchangeRouter.get("/backup", async (_req, res, next) => {
  try {
    if (currentUser(res).role !== "ADMIN") return res.status(403).json({ error: "Only admins can download backups" });
    const tables: Record<string, unknown[]> = {};
    for (const table of BACKUP_TABLES) {
      const rows = await query(`SELECT * FROM ${table} ORDER BY 1`);
      tables[table] = table === "users" ? rows.map(({ password_hash: _omit, ...rest }: any) => rest) : rows;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="roya-house-backup-${stamp}.json"`);
    res.json({ app: "roya-house-erp", version: 1, exportedAt: new Date().toISOString(), tables });
  } catch (err) {
    next(err);
  }
});
