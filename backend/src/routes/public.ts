import { Router } from "express";
import { query } from "../lib/db";

// Unauthenticated endpoints for the public landing page (/site). Only expose
// aggregate, non-sensitive data here: never prices, partner prices or documents.
export const publicRouter = Router();

// GET /api/public/catalog -> [{ category, count }] of active, stocked products.
publicRouter.get("/catalog", async (_req, res, next) => {
  try {
    const rows = await query<{ category: string; count: number }>(
      `SELECT category, count(*)::int AS count FROM products
       WHERE active AND (code IS NULL OR code NOT LIKE 'SRV-%')
       GROUP BY category`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
