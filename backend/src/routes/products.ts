import { Router } from "express";
import { z } from "zod";
import { query, queryOne, newId } from "../lib/db";

export const productsRouter = Router();

function rowToProduct(r: any) {
  return {
    id: r.id,
    code: r.code,
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

const productSchema = z.object({
  code: z.string().min(1).optional().nullable(),
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
      `INSERT INTO products (id, code, name, category, spec, unit, unit_price, partner_price, pack_size, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
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
      ]
    );
    res.status(201).json(rowToProduct(row));
  } catch (err) {
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
       partner_price=$7, pack_size=$8, active=$9, updated_at=now() WHERE id=$10 RETURNING *`,
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
      ]
    );
    res.json(rowToProduct(row));
  } catch (err) {
    next(err);
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
