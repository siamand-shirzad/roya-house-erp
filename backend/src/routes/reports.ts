import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db";

// Sales reports, aggregated in SQL so they don't load every document.
//
// Only ISSUED documents count: drafts aren't sales yet and cancelled ones
// never were. Line totals use the same formula as lib/totals.ts (qty*price
// rounded, minus the absolute discount, plus tax rounded on the discounted
// amount); for the positive amounts involved, Postgres' round() matches JS
// Math.round. Dates are grouped and filtered in Tehran time, so an invoice
// issued at 00:30 local belongs to that local day.
export const reportsRouter = Router();

const TZ = "Asia/Tehran";

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// One row per document item with its computed amounts.
const ITEMS_CTE = `
  items AS (
    SELECT i.document_id,
           i.product_id,
           i.name,
           i.unit,
           i.quantity,
           i.discount,
           round(i.quantity * i.unit_price) AS line_total,
           round(i.quantity * i.unit_price) - i.discount AS after_discount,
           round((round(i.quantity * i.unit_price) - i.discount) * i.tax_rate / 100.0) AS tax
      FROM document_items i
  )`;

// $1 = from (YYYY-MM-DD, inclusive) and $2 = to (inclusive); null means open-ended.
const IN_RANGE = `
  ($1::date IS NULL OR d.issue_date >= ($1::date)::timestamp AT TIME ZONE '${TZ}')
  AND ($2::date IS NULL OR d.issue_date < (($2::date) + 1)::timestamp AT TIME ZONE '${TZ}')`;

const num = (v: unknown) => Number(v ?? 0);

reportsRouter.get("/", async (req, res, next) => {
  try {
    const { from, to } = rangeSchema.parse(req.query);
    const params = [from ?? null, to ?? null];

    const [summary, daily, topCustomers, topProducts, categories, proformas, goodsIssues, openProformas, undelivered] =
      await Promise.all([
        query(
          `WITH ${ITEMS_CTE},
           docs AS (
             SELECT d.id,
                    sum(it.line_total) AS subtotal,
                    sum(it.discount) AS discount,
                    sum(it.tax) AS tax,
                    sum(it.after_discount + it.tax) AS grand
               FROM documents d JOIN items it ON it.document_id = d.id
              WHERE d.type = 'INVOICE' AND d.status = 'ISSUED' AND ${IN_RANGE}
              GROUP BY d.id
           )
           SELECT count(*)::int AS invoice_count,
                  COALESCE(sum(subtotal), 0) AS subtotal,
                  COALESCE(sum(discount), 0) AS discount_total,
                  COALESCE(sum(tax), 0) AS tax_total,
                  COALESCE(sum(grand), 0) AS grand_total
             FROM docs`,
          params
        ),
        query(
          `WITH ${ITEMS_CTE}
           SELECT to_char((d.issue_date AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day,
                  count(DISTINCT d.id)::int AS count,
                  sum(it.after_discount + it.tax) AS grand_total
             FROM documents d JOIN items it ON it.document_id = d.id
            WHERE d.type = 'INVOICE' AND d.status = 'ISSUED' AND ${IN_RANGE}
            GROUP BY 1
            ORDER BY 1`,
          params
        ),
        query(
          `WITH ${ITEMS_CTE}
           SELECT d.customer_id,
                  COALESCE(c.name, NULLIF(trim(d.buyer_name), ''), 'بدون نام') AS name,
                  count(DISTINCT d.id)::int AS invoice_count,
                  sum(it.after_discount + it.tax) AS grand_total
             FROM documents d
             JOIN items it ON it.document_id = d.id
             LEFT JOIN customers c ON c.id = d.customer_id
            WHERE d.type = 'INVOICE' AND d.status = 'ISSUED' AND ${IN_RANGE}
            GROUP BY 1, 2
            ORDER BY grand_total DESC
            LIMIT 10`,
          params
        ),
        query(
          `WITH ${ITEMS_CTE}
           SELECT it.product_id,
                  COALESCE(p.name, it.name) AS name,
                  p.code,
                  it.unit,
                  p.category,
                  sum(it.quantity) AS quantity,
                  sum(it.after_discount) AS amount
             FROM documents d
             JOIN items it ON it.document_id = d.id
             LEFT JOIN products p ON p.id = it.product_id
            WHERE d.type = 'INVOICE' AND d.status = 'ISSUED' AND ${IN_RANGE}
            GROUP BY it.product_id, COALESCE(p.name, it.name), p.code, it.unit, p.category
            ORDER BY amount DESC
            LIMIT 10`,
          params
        ),
        query(
          `WITH ${ITEMS_CTE}
           SELECT COALESCE(p.category, 'OTHER') AS category,
                  sum(it.after_discount) AS amount
             FROM documents d
             JOIN items it ON it.document_id = d.id
             LEFT JOIN products p ON p.id = it.product_id
            WHERE d.type = 'INVOICE' AND d.status = 'ISSUED' AND ${IN_RANGE}
            GROUP BY 1
            ORDER BY amount DESC`,
          params
        ),
        // A proforma counts as converted once a non-cancelled invoice was made from it.
        query(
          `SELECT count(*)::int AS issued,
                  count(*) FILTER (
                    WHERE EXISTS (
                      SELECT 1 FROM documents x
                       WHERE x.source_document_id = d.id AND x.type = 'INVOICE' AND x.status <> 'CANCELLED'
                    )
                  )::int AS converted
             FROM documents d
            WHERE d.type = 'PROFORMA' AND d.status = 'ISSUED' AND ${IN_RANGE}`,
          params
        ),
        query(
          `SELECT count(*)::int AS issued
             FROM documents d
            WHERE d.type = 'GOODS_ISSUE' AND d.status = 'ISSUED' AND ${IN_RANGE}`,
          params
        ),
        // Follow-up lists describe the state right now, so they ignore the date range.
        query(
          `WITH ${ITEMS_CTE},
           totals AS (SELECT document_id, sum(after_discount + tax) AS grand FROM items GROUP BY document_id)
           SELECT d.id, d.number, d.issue_date,
                  COALESCE(NULLIF(trim(d.buyer_name), ''), c.name) AS buyer_name,
                  t.grand AS grand_total,
                  ((now() AT TIME ZONE '${TZ}')::date - (d.issue_date AT TIME ZONE '${TZ}')::date) AS age_days,
                  count(*) OVER () AS total_count
             FROM documents d
             JOIN totals t ON t.document_id = d.id
             LEFT JOIN customers c ON c.id = d.customer_id
            WHERE d.type = 'PROFORMA' AND d.status = 'ISSUED'
              AND NOT EXISTS (
                SELECT 1 FROM documents x
                 WHERE x.source_document_id = d.id AND x.type = 'INVOICE' AND x.status <> 'CANCELLED'
              )
            ORDER BY d.issue_date ASC
            LIMIT 50`
        ),
        // Delivered means a non-cancelled goods issue made from the invoice, or one
        // typed in by hand that names this invoice number.
        query(
          `WITH ${ITEMS_CTE},
           totals AS (SELECT document_id, sum(after_discount + tax) AS grand FROM items GROUP BY document_id)
           SELECT d.id, d.number, d.issue_date,
                  COALESCE(NULLIF(trim(d.buyer_name), ''), c.name) AS buyer_name,
                  t.grand AS grand_total,
                  ((now() AT TIME ZONE '${TZ}')::date - (d.issue_date AT TIME ZONE '${TZ}')::date) AS age_days,
                  count(*) OVER () AS total_count
             FROM documents d
             JOIN totals t ON t.document_id = d.id
             LEFT JOIN customers c ON c.id = d.customer_id
            WHERE d.type = 'INVOICE' AND d.status = 'ISSUED'
              AND NOT EXISTS (
                SELECT 1 FROM documents x
                 WHERE x.type = 'GOODS_ISSUE' AND x.status <> 'CANCELLED'
                   AND (x.source_document_id = d.id OR trim(x.related_invoice_no) = d.number::text)
              )
            ORDER BY d.issue_date ASC
            LIMIT 50`
        ),
      ]);

    const s = summary[0];
    const invoiceCount = num(s?.invoice_count);
    const grandTotal = num(s?.grand_total);

    const followUp = (rows: any[]) => ({
      total: rows.length ? num(rows[0].total_count) : 0,
      rows: rows.map((r) => ({
        id: r.id,
        number: r.number,
        issueDate: r.issue_date,
        buyerName: r.buyer_name,
        grandTotal: num(r.grand_total),
        ageDays: num(r.age_days),
      })),
    });

    res.json({
      range: { from: from ?? null, to: to ?? null },
      sales: {
        invoiceCount,
        subtotal: num(s?.subtotal),
        discountTotal: num(s?.discount_total),
        taxTotal: num(s?.tax_total),
        grandTotal,
        averageInvoice: invoiceCount ? Math.round(grandTotal / invoiceCount) : 0,
      },
      proformas: { issued: num(proformas[0]?.issued), converted: num(proformas[0]?.converted) },
      goodsIssues: { issued: num(goodsIssues[0]?.issued) },
      daily: daily.map((r) => ({ day: r.day, count: num(r.count), grandTotal: num(r.grand_total) })),
      topCustomers: topCustomers.map((r) => ({
        customerId: r.customer_id,
        name: r.name,
        invoiceCount: num(r.invoice_count),
        grandTotal: num(r.grand_total),
      })),
      topProducts: topProducts.map((r) => ({
        productId: r.product_id,
        name: r.name,
        code: r.code,
        unit: r.unit,
        category: r.category,
        quantity: num(r.quantity),
        amount: num(r.amount),
      })),
      categories: categories.map((r) => ({ category: r.category, amount: num(r.amount) })),
      openProformas: followUp(openProformas),
      undeliveredInvoices: followUp(undelivered),
    });
  } catch (err) {
    next(err);
  }
});
