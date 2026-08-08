import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["Administrator", "User"] }).notNull().default("User"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sessions_token_idx").on(table.tokenHash),
  index("sessions_user_idx").on(table.userId),
]);

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: text("type", { enum: ["Room", "Shop", "Hall"] }).notNull(),
  monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2, mode: "number" }).notNull(),
  meterNumber: text("meter_number").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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

export const groceryItems = pgTable("grocery_items", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  minimumStock: numeric("minimum_stock", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  purchasedBy: text("purchased_by").notNull().default(""),
  expiryDate: text("expiry_date"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("grocery_items_owner_idx").on(table.ownerId),
  uniqueIndex("grocery_items_owner_name_idx").on(table.ownerId, table.name),
]);

export const groceryTransactions = pgTable("grocery_transactions", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => groceryItems.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["Stock in", "Stock out", "Correction"] }).notNull(),
  quantityChange: numeric("quantity_change", { precision: 14, scale: 2, mode: "number" }).notNull(),
  personName: text("person_name").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("grocery_transactions_owner_idx").on(table.ownerId),
  index("grocery_transactions_item_idx").on(table.itemId),
]);
