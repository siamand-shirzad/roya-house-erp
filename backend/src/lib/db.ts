import { Pool, type PoolClient } from "pg";
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

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Postgres error code of a failed query, e.g. "23505" (unique) or "23503" (foreign key). */
export const pgErrorCode = (err: unknown) =>
  typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;

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

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  username text NOT NULL UNIQUE,
  phone text,
  role text NOT NULL DEFAULT 'SALES' CHECK (role IN ('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTANT')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Added after the users table first shipped, hence ALTER ... IF NOT EXISTS.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Document lifecycle (DRAFT -> ISSUED -> CANCELLED) and conversion links.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issued_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issued_by text REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cancelled_by text REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_document_id text REFERENCES documents(id);
CREATE INDEX IF NOT EXISTS documents_source_idx ON documents(source_document_id);

-- Login sessions. id is the SHA-256 of the cookie token (the token itself is never stored).
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

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
CREATE INDEX IF NOT EXISTS document_items_document_idx ON document_items(document_id);
CREATE INDEX IF NOT EXISTS documents_customer_idx ON documents(customer_id);

-- Inventory. Stock on hand is sum(quantity) per product, never stored, so it
-- can't drift. Positive = in (receipt, reversal), negative = out (goods issue).
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock numeric(12,2);
CREATE TABLE IF NOT EXISTS stock_movements (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id),
  kind text NOT NULL CHECK (kind IN ('RECEIPT', 'ISSUE', 'ISSUE_REVERSAL', 'ADJUSTMENT')),
  quantity numeric(12,2) NOT NULL,
  document_id text REFERENCES documents(id),
  reference text,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS stock_movements_document_idx ON stock_movements(document_id);
`;
