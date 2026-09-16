import { requirePermission } from "../lib/permissions";
import { Router } from "express";
import { z } from "zod";
import { pool, query, queryOne, newId } from "../lib/db";

export const productsRouter = Router();
productsRouter.use(requirePermission("products"));

function rowToProduct(r: any) {
  return {
    id: r.id,
    code: r.code,
    brand: r.brand ?? null,
    name: r.name,
    category: r.category,
    spec: r.spec,
    unit: r.unit,
    unitPrice: r.unit_price,
    partnerPrice: r.partner_price,
    packSize: r.pack_size,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// GET /api/products?q=&category=&active=
productsRouter.get("/", async (req, res, next) => {
  try {
    const { q, category, active } = req.query as {
      q?: string;
      category?: string;
      active?: string;
    };

    const conditions: string[] = [];
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      conditions.push(`(name ILIKE $${idx} OR code ILIKE $${idx} OR spec ILIKE $${idx})`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (active !== undefined) {
      params.push(active === "true");
      conditions.push(`active = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(
      `SELECT * FROM products ${where} ORDER BY category ASC, name ASC`,
      params
    );
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await queryOne("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Product not found" });
    res.json(rowToProduct(row));
  } catch (err) {
    next(err);
  }
});

// Postgres unique_violation on products.code -> 409 instead of a generic 500.
function isDuplicateCode(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

const productSchema = z.object({
  code: z.string().min(1).optional().nullable(),
  brand: z.enum(["BANA", "GBOARD", "ROYA", "OTHER"]).optional().nullable(),
  name: z.string().min(1),
  category: z.enum([
    "GYPSUM_PANEL",
    "METAL_STRUCTURE",
    "GYPSUM_TILE",
    "SPRI_ACCESSORY",
    "SCREW_BOLT",
    "TAPE_PUTTY",
    "CONNECTOR",
    "OTHER",
    "BRAND_PANEL",
  ]),
  spec: z.string().optional().nullable(),
  unit: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  partnerPrice: z.number().int().nonnegative().optional().nullable(),
  packSize: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
});

productsRouter.post("/", async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const id = newId("prod");
    const row = await queryOne(
      `INSERT INTO products (id, code, name, category, spec, unit, unit_price, partner_price, pack_size, active, brand)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        id,
        data.code ?? null,
        data.name,
        data.category,
        data.spec ?? null,
        data.unit,
        data.unitPrice,
        data.partnerPrice ?? null,
        data.packSize ?? null,
        data.active ?? true,
        data.brand ?? null,
      ]
    );
    res.status(201).json(rowToProduct(row));
  } catch (err) {
    if (isDuplicateCode(err)) return res.status(409).json({ error: "Product code already exists" });
    next(err);
  }
});

productsRouter.put("/:id", async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const existing = await queryOne("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const merged = {
      code: data.code !== undefined ? data.code : existing.code,
      name: data.name ?? existing.name,
      category: data.category ?? existing.category,
      spec: data.spec !== undefined ? data.spec : existing.spec,
      unit: data.unit ?? existing.unit,
      unitPrice: data.unitPrice ?? existing.unit_price,
      partnerPrice: data.partnerPrice !== undefined ? data.partnerPrice : existing.partner_price,
      packSize: data.packSize !== undefined ? data.packSize : existing.pack_size,
      active: data.active ?? existing.active,
    };

    const row = await queryOne(
      `UPDATE products SET code=$1, name=$2, category=$3, spec=$4, unit=$5, unit_price=$6,
       partner_price=$7, pack_size=$8, active=$9, brand=$11, updated_at=now() WHERE id=$10 RETURNING *`,
      [
        merged.code,
        merged.name,
        merged.category,
        merged.spec,
        merged.unit,
        merged.unitPrice,
        merged.partnerPrice,
        merged.packSize,
        merged.active,
        req.params.id,
        data.brand !== undefined ? data.brand : existing.brand,
      ]
    );
    res.json(rowToProduct(row));
  } catch (err) {
    if (isDuplicateCode(err)) return res.status(409).json({ error: "Product code already exists" });
    next(err);
  }
});

// PATCH /api/products/bulk: save many inline price edits at once (price table).
// All-or-nothing: an unknown id rolls the whole batch back.
const bulkSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        expectedUpdatedAt: z.iso.datetime().optional(),
        unitPrice: z.number().int().nonnegative().optional(),
        partnerPrice: z.number().int().nonnegative().nullable().optional(),
      })
    )
    .min(1)
    .max(2000),
});

productsRouter.patch("/bulk", async (req, res, next) => {
  let client;
  try {
    const { updates } = bulkSchema.parse(req.body);
    client = await pool.connect();
    await client.query("BEGIN");
    const missing: string[] = [];
    for (const u of [...updates].sort((a, b) => a.id.localeCompare(b.id))) {
      const locked = await client.query("SELECT updated_at FROM products WHERE id=$1 FOR UPDATE", [u.id]);
      if (locked.rows[0] && u.expectedUpdatedAt && new Date(locked.rows[0].updated_at).getTime() !== Date.parse(u.expectedUpdatedAt)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Prices changed since you loaded them; reload before saving", id: u.id });
      }
      const r = await client.query(
        `UPDATE products SET
           unit_price = COALESCE($2, unit_price),
           partner_price = CASE WHEN $3::boolean THEN $4::integer ELSE partner_price END,
           updated_at = now()
         WHERE id = $1`,
        [u.id, u.unitPrice ?? null, u.partnerPrice !== undefined, u.partnerPrice ?? null]
      );
      if (r.rowCount === 0) missing.push(u.id);
    }
    if (missing.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Some products were not found", ids: missing });
    }
    await client.query("COMMIT");
    res.json({ updated: updates.length });
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client?.release();
  }
});

// POST /api/products/import: upsert rows from a CSV by product code.
// Products missing from the file are left untouched (never deleted).
const importSchema = z.object({
  rows: z
    .array(productSchema.extend({ code: z.string().trim().min(1) }))
    .min(1)
    .max(5000),
});

productsRouter.post("/import", async (req, res, next) => {
  let client;
  try {
    const { rows } = importSchema.parse(req.body);
    const seen = new Set<string>();
    const duplicates = rows.map((r) => r.code).filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
    if (duplicates.length) {
      return res.status(400).json({ error: "Duplicate product codes in file", codes: [...new Set(duplicates)] });
    }

    client = await pool.connect();
    await client.query("BEGIN");
    let created = 0;
    let updated = 0;
    for (const p of rows) {
      const values = [
        p.name,
        p.category,
        p.spec ?? null,
        p.unit,
        p.unitPrice,
        p.partnerPrice ?? null,
        p.packSize ?? null,
      ];
      const r = await client.query(
        `UPDATE products SET name=$2, category=$3, spec=$4, unit=$5, unit_price=$6, partner_price=$7,
           pack_size=$8, active=COALESCE($9, active), brand=CASE WHEN $10::boolean THEN $11 ELSE brand END, updated_at=now()
         WHERE code=$1`,
        [p.code, ...values, p.active ?? null, p.brand !== undefined, p.brand ?? null]
      );
      if (r.rowCount) {
        updated++;
      } else {
        await client.query(
          `INSERT INTO products (id, code, name, category, spec, unit, unit_price, partner_price, pack_size, active, brand)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [newId("prod"), p.code, ...values, p.active ?? true, p.brand ?? null]
        );
        created++;
      }
    }
    await client.query("COMMIT");
    res.json({ created, updated });
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client?.release();
  }
});

productsRouter.delete("/:id", async (req, res, next) => {
  try {
    // Soft-delete: keep historical documents intact, just hide from catalog.
    const row = await queryOne(
      "UPDATE products SET active = false, updated_at = now() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: "Product not found" });
    res.json(rowToProduct(row));
  } catch (err) {
    next(err);
  }
});
