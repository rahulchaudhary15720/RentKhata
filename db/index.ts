import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let initialization: Promise<void> | null = null;

export function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Add a Neon PostgreSQL database to the Vercel project and set DATABASE_URL.",
    );
  }
  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

export function initializeDb() {
  if (initialization) return initialization;

  initialization = (async () => {
    const sql = getSqlClient();

    await sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Manager'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('Administrator', 'Manager'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

    await sql`CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token_hash)`;
    await sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`;

    await sql`CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('Room', 'Shop', 'Hall')),
      monthly_rent NUMERIC(12,2) NOT NULL,
      meter_number TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      move_in_date TEXT NOT NULL,
      security_deposit NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      unit_id INTEGER NOT NULL REFERENCES units(id),
      bill_month TEXT NOT NULL,
      previous_reading NUMERIC(14,2) NOT NULL DEFAULT 0,
      current_reading NUMERIC(14,2) NOT NULL DEFAULT 0,
      rate_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
      units_used NUMERIC(14,2) NOT NULL DEFAULT 0,
      electricity_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      rent_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      other_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Overdue')),
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS bills_tenant_month_idx
      ON bills (tenant_id, bill_month)`;

    // Existing single-user deployments are upgraded in place. The first account
    // created claims legacy rows; all newly-created rows always have an owner.
    await sql`ALTER TABLE units ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
    await sql`CREATE INDEX IF NOT EXISTS units_owner_idx ON units (owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS tenants_owner_idx ON tenants (owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS bills_owner_idx ON bills (owner_id)`;

    await sql`CREATE TABLE IF NOT EXISTS grocery_items (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      minimum_stock NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      expiry_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS grocery_items_owner_idx ON grocery_items (owner_id)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS grocery_items_owner_name_idx ON grocery_items (owner_id, LOWER(name))`;

    await sql`CREATE TABLE IF NOT EXISTS grocery_transactions (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES grocery_items(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('Stock in', 'Stock out', 'Correction')),
      quantity_change NUMERIC(14,2) NOT NULL CHECK (quantity_change <> 0),
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS grocery_transactions_owner_idx ON grocery_transactions (owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS grocery_transactions_item_idx ON grocery_transactions (item_id)`;
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}
