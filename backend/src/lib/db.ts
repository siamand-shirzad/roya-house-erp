import { Pool } from "pg";
import { randomUUID } from "crypto";

// Plain `pg` data-access layer. This project was originally written against
// Prisma, but Prisma's query/schema engine binaries are fetched from
// binaries.prisma.sh at install/generate time — in an environment where
// that specific host is blocked (while the npm registry itself is fine),
// Prisma can't be used at all. Raw SQL over `pg` has no such external
// dependency, so that's what actually runs here. `prisma/schema.prisma` is
// kept in the repo as the canonical, human-readable model reference; this
// file is a hand-written mirror of the same tables.

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY,
  name text NOT NULL,
  legal_name text,
  national_id text,
  economic_code text,
  registration text,
  province text,
  city text,
  address text,
  postal_code text,
  phone text,
  fax text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  customer_code text,
  national_id text,
  economic_code text,
  registration text,
  province text,
  city text,
  address text,
  postal_code text,
  phone text,
  fax text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  spec text,
  unit text NOT NULL,
  unit_price integer NOT NULL,
  partner_price integer,
  pack_size integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  type text NOT NULL,
  number integer NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  issue_date timestamptz NOT NULL DEFAULT now(),
  company_id text REFERENCES companies(id),
  customer_id text REFERENCES customers(id),
  buyer_name text,
  buyer_national_id text,
  buyer_economic_code text,
  buyer_province text,
  buyer_city text,
  buyer_address text,
  buyer_postal_code text,
  buyer_phone text,
  related_invoice_no text,
  vehicle_plate text,
  vehicle_color text,
  delivered_to_name text,
  delivered_to_national_id text,
  notes text,
  discount_total integer NOT NULL DEFAULT 0,
  tax_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, number)
);

CREATE TABLE IF NOT EXISTS document_items (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id),
  row_no integer NOT NULL,
  name text NOT NULL,
  spec text,
  unit text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  unit_price integer NOT NULL,
  discount integer NOT NULL DEFAULT 0,
  tax_rate integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
