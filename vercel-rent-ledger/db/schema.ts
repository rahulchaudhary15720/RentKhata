import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type", { enum: ["Room", "Shop", "Hall"] }).notNull(),
  monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2, mode: "number" }).notNull(),
  meterNumber: text("meter_number").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  unitId: integer("unit_id").notNull().references(() => units.id),
  moveInDate: text("move_in_date").notNull(),
  securityDeposit: numeric("security_deposit", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  notes: text("notes").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  unitId: integer("unit_id").notNull().references(() => units.id),
  billMonth: text("bill_month").notNull(),
  previousReading: numeric("previous_reading", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  currentReading: numeric("current_reading", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  ratePerUnit: numeric("rate_per_unit", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
  unitsUsed: numeric("units_used", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  electricityAmount: numeric("electricity_amount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  rentAmount: numeric("rent_amount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  otherCharges: numeric("other_charges", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["Pending", "Paid", "Overdue"] }).notNull().default("Pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("bills_tenant_month_idx").on(table.tenantId, table.billMonth),
]);
