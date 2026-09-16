import { requirePermission } from "../lib/permissions";
import { Router } from "express";
import { z } from "zod";
import { query, queryOne, newId } from "../lib/db";

export const customersRouter = Router();
customersRouter.use(requirePermission("customers"));

function rowToCustomer(r: any) {
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

customersRouter.get("/", async (req, res, next) => {
  try {
    const { q } = req.query as { q?: string };
    const rows = q
      ? await query(
          `SELECT * FROM customers WHERE name ILIKE $1 OR customer_code ILIKE $1 OR phone ILIKE $1 ORDER BY name ASC`,
          [`%${q}%`]
        )
      : await query(`SELECT * FROM customers ORDER BY name ASC`);
    res.json(rows.map(rowToCustomer));
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await queryOne("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json(rowToCustomer(row));
  } catch (err) {
    next(err);
  }
});

const customerSchema = z.object({
  name: z.string().min(1),
  customerCode: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  economicCode: z.string().optional().nullable(),
  registration: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
});

customersRouter.post("/", async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);
    const id = newId("cust");
    const row = await queryOne(
      `INSERT INTO customers (id, name, customer_code, national_id, economic_code, registration, province, city, address, postal_code, phone, fax)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        id,
        data.name,
        data.customerCode ?? null,
        data.nationalId ?? null,
        data.economicCode ?? null,
        data.registration ?? null,
        data.province ?? null,
        data.city ?? null,
        data.address ?? null,
        data.postalCode ?? null,
        data.phone ?? null,
        data.fax ?? null,
      ]
    );
    res.status(201).json(rowToCustomer(row));
  } catch (err) {
    next(err);
  }
});

// Only a customer no document points at can be deleted: documents keep their
// own copy of the buyer, but customer_id still links them for reports.
customersRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT id FROM customers WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Customer not found" });
    const used = await queryOne("SELECT 1 FROM documents WHERE customer_id = $1 LIMIT 1", [req.params.id]);
    if (used) return res.status(409).json({ error: "Customer has documents" });
    await query("DELETE FROM customers WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

customersRouter.put("/:id", async (req, res, next) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    const existing = await queryOne("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Customer not found" });

    const merged = {
      name: data.name ?? existing.name,
      customerCode: data.customerCode !== undefined ? data.customerCode : existing.customer_code,
      nationalId: data.nationalId !== undefined ? data.nationalId : existing.national_id,
      economicCode: data.economicCode !== undefined ? data.economicCode : existing.economic_code,
      registration: data.registration !== undefined ? data.registration : existing.registration,
      province: data.province !== undefined ? data.province : existing.province,
      city: data.city !== undefined ? data.city : existing.city,
      address: data.address !== undefined ? data.address : existing.address,
      postalCode: data.postalCode !== undefined ? data.postalCode : existing.postal_code,
      phone: data.phone !== undefined ? data.phone : existing.phone,
      fax: data.fax !== undefined ? data.fax : existing.fax,
    };

    const row = await queryOne(
      `UPDATE customers SET name=$1, customer_code=$2, national_id=$3, economic_code=$4, registration=$5,
       province=$6, city=$7, address=$8, postal_code=$9, phone=$10, fax=$11, updated_at=now()
       WHERE id=$12 RETURNING *`,
      [
        merged.name,
        merged.customerCode,
        merged.nationalId,
        merged.economicCode,
        merged.registration,
        merged.province,
        merged.city,
        merged.address,
        merged.postalCode,
        merged.phone,
        merged.fax,
        req.params.id,
      ]
    );
    res.json(rowToCustomer(row));
  } catch (err) {
    next(err);
  }
});
