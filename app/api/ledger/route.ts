import { and, asc, desc, eq, ne } from "drizzle-orm";
import { getDb, initializeDb } from "@/db";
import { bills, tenants, units } from "@/db/schema";

type ActionPayload = {
  action?: string;
  id?: number;
  unitId?: number;
  tenantId?: number;
  label?: string;
  type?: "Room" | "Shop" | "Hall";
  monthlyRent?: number;
  meterNumber?: string;
  name?: string;
  phone?: string;
  moveInDate?: string;
  securityDeposit?: number;
  notes?: string;
  billMonth?: string;
  previousReading?: number;
  currentReading?: number;
  ratePerUnit?: number;
  rentAmount?: number;
  otherCharges?: number;
  dueDate?: string;
};

const cleanPhone = (phone = "") => phone.replace(/[^\d+]/g, "");
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export async function GET() {
  try {
    await initializeDb();
    const db = getDb();
    const [unitRows, tenantRows, billRows] = await Promise.all([
      db.select().from(units).orderBy(asc(units.label)),
      db.select().from(tenants).orderBy(desc(tenants.active), asc(tenants.name)),
      db.select().from(bills).orderBy(desc(bills.billMonth), desc(bills.createdAt)),
    ]);
    return Response.json({ units: unitRows, tenants: tenantRows, bills: billRows });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load ledger data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ActionPayload;
    await initializeDb();
    const db = getDb();

    if (payload.action === "addUnit") {
      if (!payload.label?.trim() || !payload.type || number(payload.monthlyRent) <= 0) {
        return Response.json({ error: "Unit name, type and monthly rent are required." }, { status: 400 });
      }
      const [unit] = await db.insert(units).values({
        label: payload.label.trim(),
        type: payload.type,
        monthlyRent: number(payload.monthlyRent),
        meterNumber: payload.meterNumber?.trim() ?? "",
      }).returning();
      return Response.json({ unit }, { status: 201 });
    }

    if (payload.action === "updateUnit" && payload.id) {
      if (!payload.label?.trim() || !payload.type || number(payload.monthlyRent) <= 0) {
        return Response.json({ error: "Unit name, type and monthly rent are required." }, { status: 400 });
      }
      const [unit] = await db.update(units).set({
        label: payload.label.trim(),
        type: payload.type,
        monthlyRent: number(payload.monthlyRent),
        meterNumber: payload.meterNumber?.trim() ?? "",
      }).where(eq(units.id, payload.id)).returning();
      return Response.json({ unit });
    }

    if (payload.action === "addTenant") {
      if (!payload.name?.trim() || !payload.phone?.trim() || !payload.unitId || !payload.moveInDate) {
        return Response.json({ error: "Name, phone, unit and move-in date are required." }, { status: 400 });
      }
      const [tenant] = await db.insert(tenants).values({
        name: payload.name.trim(),
        phone: cleanPhone(payload.phone),
        unitId: payload.unitId,
        moveInDate: payload.moveInDate,
        securityDeposit: number(payload.securityDeposit),
        notes: payload.notes?.trim() ?? "",
      }).returning();
      return Response.json({ tenant }, { status: 201 });
    }

    if (payload.action === "updateTenant" && payload.id) {
      if (!payload.name?.trim() || !payload.phone?.trim() || !payload.unitId || !payload.moveInDate) {
        return Response.json({ error: "Name, phone, unit and move-in date are required." }, { status: 400 });
      }
      const [tenant] = await db.update(tenants).set({
        name: payload.name.trim(),
        phone: cleanPhone(payload.phone),
        unitId: payload.unitId,
        moveInDate: payload.moveInDate,
        securityDeposit: number(payload.securityDeposit),
        notes: payload.notes?.trim() ?? "",
      }).where(eq(tenants.id, payload.id)).returning();
      return Response.json({ tenant });
    }

    if (payload.action === "addBill") {
      if (!payload.tenantId || !payload.unitId || !payload.billMonth || !payload.dueDate) {
        return Response.json({ error: "Tenant, bill month and due date are required." }, { status: 400 });
      }
      const previous = number(payload.previousReading);
      const current = number(payload.currentReading);
      if (current < previous) {
        return Response.json({ error: "Current reading cannot be less than the previous reading." }, { status: 400 });
      }
      const used = current - previous;
      const electricity = used * number(payload.ratePerUnit);
      const rent = number(payload.rentAmount);
      const other = number(payload.otherCharges);
      const [existingBill] = await db.select({ id: bills.id }).from(bills)
        .where(and(
          eq(bills.tenantId, payload.tenantId),
          eq(bills.billMonth, payload.billMonth),
        )).limit(1);
      if (existingBill) {
        return Response.json(
          { error: "A bill already exists for this occupant and month." },
          { status: 409 },
        );
      }
      const [bill] = await db.insert(bills).values({
        tenantId: payload.tenantId,
        unitId: payload.unitId,
        billMonth: payload.billMonth,
        previousReading: previous,
        currentReading: current,
        ratePerUnit: number(payload.ratePerUnit),
        unitsUsed: used,
        electricityAmount: electricity,
        rentAmount: rent,
        otherCharges: other,
        totalAmount: rent + electricity + other,
        dueDate: payload.dueDate,
      }).returning();
      return Response.json({ bill }, { status: 201 });
    }

    if (payload.action === "updateBill" && payload.id) {
      if (!payload.tenantId || !payload.unitId || !payload.billMonth || !payload.dueDate) {
        return Response.json({ error: "Tenant, bill month and due date are required." }, { status: 400 });
      }
      const previous = number(payload.previousReading);
      const current = number(payload.currentReading);
      if (current < previous) {
        return Response.json({ error: "Current reading cannot be less than the previous reading." }, { status: 400 });
      }
      const used = current - previous;
      const electricity = used * number(payload.ratePerUnit);
      const rent = number(payload.rentAmount);
      const other = number(payload.otherCharges);
      const [existingBill] = await db.select({ id: bills.id }).from(bills)
        .where(and(
          eq(bills.tenantId, payload.tenantId),
          eq(bills.billMonth, payload.billMonth),
          ne(bills.id, payload.id),
        )).limit(1);
      if (existingBill) {
        return Response.json(
          { error: "A bill already exists for this occupant and month." },
          { status: 409 },
        );
      }
      const [bill] = await db.update(bills).set({
        tenantId: payload.tenantId,
        unitId: payload.unitId,
        billMonth: payload.billMonth,
        previousReading: previous,
        currentReading: current,
        ratePerUnit: number(payload.ratePerUnit),
        unitsUsed: used,
        electricityAmount: electricity,
        rentAmount: rent,
        otherCharges: other,
        totalAmount: rent + electricity + other,
        dueDate: payload.dueDate,
      }).where(eq(bills.id, payload.id)).returning();
      return Response.json({ bill });
    }

    if (payload.action === "markPaid" && payload.id) {
      const [bill] = await db.update(bills).set({
        status: "Paid",
        paidAt: new Date(),
      }).where(eq(bills.id, payload.id)).returning();
      return Response.json({ bill });
    }

    if (payload.action === "vacateTenant" && payload.id) {
      const [tenant] = await db.update(tenants).set({ active: false })
        .where(eq(tenants.id, payload.id)).returning();
      return Response.json({ tenant });
    }

    if (payload.action === "deleteTenant" && payload.id) {
      await db.delete(bills).where(eq(bills.tenantId, payload.id));
      await db.delete(tenants).where(eq(tenants.id, payload.id));
      return Response.json({ success: true });
    }

    if (payload.action === "deleteBill" && payload.id) {
      await db.delete(bills).where(eq(bills.id, payload.id));
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save changes" },
      { status: 500 },
    );
  }
}
