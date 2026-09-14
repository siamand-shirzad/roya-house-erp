import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../lib/db";
import { requireRole } from "../lib/auth";

// The seller printed on every document. There is one row; documents link to it
// when they are created. Everyone signed in can read it, only admins edit it.
export const companyRouter = Router();

export function rowToCompany(r: any) {
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

export const currentCompany = () => queryOne("SELECT * FROM companies ORDER BY created_at ASC LIMIT 1");

// A fresh production database is never seeded, which used to leave documents
// with no seller. Create the default row once; admins edit it from the UI.
export async function ensureCompany() {
  await query(
    `INSERT INTO companies (id, name, legal_name, province, city, address, phone)
     SELECT $1, $2, $2, $3, $3, $4, $5
     WHERE NOT EXISTS (SELECT 1 FROM companies)`,
    [
      "royahouse-main",
      "رویا هاوس",
      "تهران",
      "تهران، چهاردانگه به آزادگان شرق، خیابان غفاری، خیابان عرفان، عرفان یکم غربی، پلاک 105",
      "09357205000 / 09356115000",
    ]
  );
}

companyRouter.get("/", async (_req, res, next) => {
  try {
    res.json(rowToCompany(await currentCompany()));
  } catch (err) {
    next(err);
  }
});

const text = z.string().trim().max(500).optional().nullable();
const companySchema = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: text,
  nationalId: text,
  economicCode: text,
  registration: text,
  province: text,
  city: text,
  address: text,
  postalCode: text,
  phone: text,
  fax: text,
});

companyRouter.put("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const d = companySchema.parse(req.body);
    await ensureCompany();
    const existing = await currentCompany();
    const row = await queryOne(
      `UPDATE companies SET name=$1, legal_name=$2, national_id=$3, economic_code=$4, registration=$5,
         province=$6, city=$7, address=$8, postal_code=$9, phone=$10, fax=$11, updated_at=now()
       WHERE id=$12 RETURNING *`,
      [
        d.name,
        d.legalName || null,
        d.nationalId || null,
        d.economicCode || null,
        d.registration || null,
        d.province || null,
        d.city || null,
        d.address || null,
        d.postalCode || null,
        d.phone || null,
        d.fax || null,
        existing.id,
      ]
    );
    res.json(rowToCompany(row));
  } catch (err) {
    next(err);
  }
});
