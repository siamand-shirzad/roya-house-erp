import { can, type Module, requirePermission } from "../lib/permissions";
import { Router, type Response } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { newId, pgErrorCode, query, queryOne, withTransaction } from "../lib/db";
import { type AuthUser } from "../lib/auth";

// Inventory: stock on hand per product is the sum of its stock_movements.
// Receipts and adjustments are entered here; goods issues add ISSUE movements
// when issued and ISSUE_REVERSAL movements when cancelled (routes/documents.ts).
// Reading is open to everyone signed in; writing needs ADMIN or WAREHOUSE.
export const inventoryRouter = Router();
inventoryRouter.use(requirePermission("inventory"));

export const INVENTORY_WRITE_ROLES = ["ADMIN", "WAREHOUSE"] as const;


const currentUser = (res: Response) => res.locals.user as AuthUser;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// Adjustments read the current sum and write the difference; the lock keeps
// two concurrent counts of the same product from both applying.
const lockProduct = (client: PoolClient, productId: string) =>
  client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`stock:${productId}`]);

export type StockWarning = { productId: string; name: string; unit: string; available: number; requested: number };

/** Products on a document whose requested quantity exceeds stock on hand. */
export async function stockShortfalls(documentId: string, client?: PoolClient): Promise<StockWarning[]> {
  const sql = `
    SELECT i.product_id, min(i.name) AS name, min(i.unit) AS unit, sum(i.quantity) AS requested,
           COALESCE((SELECT sum(m.quantity) FROM stock_movements m WHERE m.product_id = i.product_id), 0) AS available
    FROM document_items i
    WHERE i.document_id = $1 AND i.product_id IS NOT NULL
    GROUP BY i.product_id
    HAVING sum(i.quantity) > COALESCE((SELECT sum(m.quantity) FROM stock_movements m WHERE m.product_id = i.product_id), 0)
    ORDER BY min(i.row_no)`;
  const rows = client ? (await client.query(sql, [documentId])).rows : await query(sql, [documentId]);
  return rows.map((r: any) => ({
    productId: r.product_id,
    name: r.name,
    unit: r.unit,
    available: Number(r.available),
    requested: Number(r.requested),
  }));
}

/** Book an issued goods issue out of stock: one negative movement per product. */
export async function postGoodsIssueMovements(client: PoolClient, documentId: string, userId: string) {
  const items = await client.query(
    `SELECT product_id, sum(quantity) AS quantity FROM document_items
     WHERE document_id = $1 AND product_id IS NOT NULL GROUP BY product_id`,
    [documentId]
  );
  for (const it of items.rows) {
    await client.query(
      `INSERT INTO stock_movements (id, product_id, kind, quantity, document_id, created_by)
       VALUES ($1,$2,'ISSUE',$3,$4,$5)`,
      [newId("move"), it.product_id, -Number(it.quantity), documentId, userId]
    );
  }
}

/**
 * Put a cancelled goods issue back into stock by reversing exactly what it
 * booked. Goods issues issued before inventory existed booked nothing, so
 * cancelling them changes nothing either.
 */
export async function reverseGoodsIssueMovements(client: PoolClient, documentId: string, userId: string) {
  const booked = await client.query(
    "SELECT product_id, quantity FROM stock_movements WHERE document_id = $1 AND kind = 'ISSUE'",
    [documentId]
  );
  for (const m of booked.rows) {
    await client.query(
      `INSERT INTO stock_movements (id, product_id, kind, quantity, document_id, created_by)
       VALUES ($1,$2,'ISSUE_REVERSAL',$3,$4,$5)`,
      [newId("move"), m.product_id, -Number(m.quantity), documentId, userId]
    );
  }
}

// GET /api/inventory/stock: every active product with its stock on hand.
inventoryRouter.get("/stock", async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT p.id, p.code, p.name, p.category, p.spec, p.unit, p.min_stock,
              COALESCE(sum(m.quantity), 0) AS on_hand, max(m.created_at) AS last_movement_at
       FROM products p
       LEFT JOIN stock_movements m ON m.product_id = p.id
       WHERE p.active
       GROUP BY p.id
       ORDER BY p.category ASC, p.name ASC`
    );
    res.json(
      rows.map((r: any) => ({
        productId: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        spec: r.spec,
        unit: r.unit,
        onHand: Number(r.on_hand),
        minStock: num(r.min_stock),
        lastMovementAt: r.last_movement_at,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/movements?productId=&from=&to=  (newest first, capped)
inventoryRouter.get("/movements", async (req, res, next) => {
  try {
    const { productId, from, to, offset, limit } = z
      .object({
        productId: z.string().min(1).optional(),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        offset: z.coerce.number().int().min(0).max(10000000).default(0),
        limit: z.coerce.number().int().min(1).max(2000).default(200),
      })
      .parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (productId) {
      params.push(productId);
      conditions.push(`m.product_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`(m.created_at AT TIME ZONE 'Asia/Tehran')::date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`(m.created_at AT TIME ZONE 'Asia/Tehran')::date <= $${params.length}::date`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(
      `SELECT m.*, p.name AS product_name, p.code AS product_code, p.unit AS product_unit,
              u.full_name AS created_by_name, d.type AS document_type, d.number AS document_number
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.created_by
       LEFT JOIN documents d ON d.id = m.document_id
       ${where}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(
      rows.map((r: any) => ({
        id: r.id,
        productId: r.product_id,
        productName: r.product_name,
        productCode: r.product_code,
        unit: r.product_unit,
        kind: r.kind,
        quantity: Number(r.quantity),
        reference: r.reference,
        document: r.document_id && can(currentUser(res), r.document_type.toLowerCase() as Module) ? { id: r.document_id, type: r.document_type, number: r.document_number } : null,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/receipts: goods arriving at the warehouse.
const receiptSchema = z.object({
  reference: z.string().trim().max(300).optional().nullable(),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().positive().max(9_999_999_999) }))
    .min(1)
    .max(500),
});

inventoryRouter.post("/receipts", async (req, res, next) => {
  try {
    const data = receiptSchema.parse(req.body);
    await withTransaction(async (client) => {
      for (const item of data.items) {
        await client.query(
          `INSERT INTO stock_movements (id, product_id, kind, quantity, reference, created_by)
           VALUES ($1,$2,'RECEIPT',$3,$4,$5)`,
          [newId("move"), item.productId, item.quantity, data.reference || null, currentUser(res).id]
        );
      }
    });
    res.status(201).json({ created: data.items.length });
  } catch (err) {
    if (pgErrorCode(err) === "23503") return res.status(404).json({ error: "Some products were not found" });
    next(err);
  }
});

// POST /api/inventory/adjustments: a stock count. Writes the difference between
// the counted and the booked quantity (also how opening stock is entered).
const adjustmentSchema = z.object({
  productId: z.string().min(1),
  countedQuantity: z.number().min(-9_999_999_999).max(9_999_999_999),
  reason: z.string().trim().min(1).max(300),
});

inventoryRouter.post("/adjustments", async (req, res, next) => {
  try {
    const data = adjustmentSchema.parse(req.body);
    const product = await queryOne("SELECT id FROM products WHERE id = $1", [data.productId]);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const result = await withTransaction(async (client) => {
      await lockProduct(client, data.productId);
      const r = await client.query(
        "SELECT COALESCE(sum(quantity), 0) AS on_hand FROM stock_movements WHERE product_id = $1",
        [data.productId]
      );
      const before = Number(r.rows[0].on_hand);
      const difference = Math.round((data.countedQuantity - before) * 100) / 100;
      if (difference !== 0) {
        await client.query(
          `INSERT INTO stock_movements (id, product_id, kind, quantity, reference, created_by)
           VALUES ($1,$2,'ADJUSTMENT',$3,$4,$5)`,
          [newId("move"), data.productId, difference, data.reason, currentUser(res).id]
        );
      }
      return { before, after: data.countedQuantity, difference };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/inventory/min-stock: the level below which a product counts as low.
inventoryRouter.patch("/min-stock", async (req, res, next) => {
  try {
    const data = z
      .object({ productId: z.string().min(1), minStock: z.number().nonnegative().max(9_999_999_999).nullable() })
      .parse(req.body);
    const row = await queryOne("UPDATE products SET min_stock = $2, updated_at = now() WHERE id = $1 RETURNING id", [
      data.productId,
      data.minStock,
    ]);
    if (!row) return res.status(404).json({ error: "Product not found" });
    res.json({ productId: data.productId, minStock: data.minStock });
  } catch (err) {
    next(err);
  }
});
