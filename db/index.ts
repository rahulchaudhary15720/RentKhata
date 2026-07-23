import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let initialization: Promise<void> | null = null;

function getSqlClient() {
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
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}
