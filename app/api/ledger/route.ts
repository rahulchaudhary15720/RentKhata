import { and, asc, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { bills, tenants, units, users } from "@/db/schema";
import { requireUser } from "@/app/lib/auth";

type ActionPayload = {
  action?: string;
  id?: number;
  unitId?: number;
  tenantId?: number;
  ownerId?: number;
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
    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const db = getDb();
    const administrator = auth.user.role === "Administrator";
    const [unitRows, tenantRows, billRows, owners] = await Promise.all([
      db.select().from(units).where(administrator ? undefined : eq(units.ownerId, auth.user.id)).orderBy(asc(units.label)),
      db.select().from(tenants).where(administrator ? undefined : eq(tenants.ownerId, auth.user.id)).orderBy(desc(tenants.active), asc(tenants.name)),
      db.select().from(bills).where(administrator ? undefined : eq(bills.ownerId, auth.user.id)).orderBy(desc(bills.billMonth), desc(bills.createdAt)),
      administrator ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)) : Promise.resolve([]),
    ]);
    return Response.json({ units: unitRows, tenants: tenantRows, bills: billRows, owners });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load ledger data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const payload = await request.json().catch(() => null) as ActionPayload | null;
    if (!payload) return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    const db = getDb();
    const ownerId = auth.user.id;
    const administrator = auth.user.role === "Administrator";
    const targetOwnerId = administrator && payload.ownerId ? payload.ownerId : ownerId;

    if (payload.action === "addUnit") {
      if (!payload.label?.trim() || !payload.type || number(payload.monthlyRent) <= 0) {
        return Response.json({ error: "Unit name, type and monthly rent are required." }, { status: 400 });
      }
      if (administrator && payload.ownerId) {
        const [target] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, payload.ownerId), eq(users.active, true))).limit(1);
        if (!target) return Response.json({ error: "Selected record owner was not found or is inactive." }, { status: 404 });
      }
      const [unit] = await db.insert(units).values({
        ownerId: targetOwnerId,
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
      }).where(administrator ? eq(units.id, payload.id) : and(eq(units.id, payload.id), eq(units.ownerId, ownerId))).returning();
      return unit ? Response.json({ unit }) : Response.json({ error: "Property unit not found." }, { status: 404 });
    }

    if (payload.action === "addTenant") {
      if (!payload.name?.trim() || !payload.phone?.trim() || !payload.unitId || !payload.moveInDate) {
        return Response.json({ error: "Name, phone, unit and move-in date are required." }, { status: 400 });
      }
      const [ownedUnit] = await db.select({ id: units.id, ownerId: units.ownerId }).from(units).where(administrator ? eq(units.id, payload.unitId) : and(eq(units.id, payload.unitId), eq(units.ownerId, ownerId))).limit(1);
      if (!ownedUnit) return Response.json({ error: "Property unit not found." }, { status: 404 });
      const [tenant] = await db.insert(tenants).values({
        ownerId: ownedUnit.ownerId,
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
      const [ownedUnit] = await db.select({ id: units.id, ownerId: units.ownerId }).from(units).where(administrator ? eq(units.id, payload.unitId) : and(eq(units.id, payload.unitId), eq(units.ownerId, ownerId))).limit(1);
      if (!ownedUnit) return Response.json({ error: "Property unit not found." }, { status: 404 });
      const [tenant] = await db.update(tenants).set({
        name: payload.name.trim(),
        phone: cleanPhone(payload.phone),
        unitId: payload.unitId,
        moveInDate: payload.moveInDate,
        securityDeposit: number(payload.securityDeposit),
        notes: payload.notes?.trim() ?? "",
        ownerId: ownedUnit.ownerId,
      }).where(administrator ? eq(tenants.id, payload.id) : and(eq(tenants.id, payload.id), eq(tenants.ownerId, ownerId))).returning();
      if (tenant && administrator) await db.update(bills).set({ ownerId: ownedUnit.ownerId }).where(eq(bills.tenantId, tenant.id));
      return tenant ? Response.json({ tenant }) : Response.json({ error: "Occupant not found." }, { status: 404 });
    }

    if (payload.action === "addBill") {
      if (!payload.tenantId || !payload.unitId || !payload.billMonth || !payload.dueDate) {
        return Response.json({ error: "Tenant, bill month and due date are required." }, { status: 400 });
      }
      const [ownedTenant] = await db.select({ id: tenants.id, unitId: tenants.unitId, ownerId: tenants.ownerId }).from(tenants).where(administrator ? eq(tenants.id, payload.tenantId) : and(eq(tenants.id, payload.tenantId), eq(tenants.ownerId, ownerId))).limit(1);
      if (!ownedTenant || ownedTenant.unitId !== payload.unitId) return Response.json({ error: "Occupant and property selection is invalid." }, { status: 404 });
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
          eq(bills.ownerId, ownedTenant.ownerId),
        )).limit(1);
      if (existingBill) {
        return Response.json(
          { error: "A bill already exists for this occupant and month." },
          { status: 409 },
        );
      }
      const [bill] = await db.insert(bills).values({
        ownerId: ownedTenant.ownerId,
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
      const [ownedTenant] = await db.select({ id: tenants.id, unitId: tenants.unitId, ownerId: tenants.ownerId }).from(tenants).where(administrator ? eq(tenants.id, payload.tenantId) : and(eq(tenants.id, payload.tenantId), eq(tenants.ownerId, ownerId))).limit(1);
      if (!ownedTenant || ownedTenant.unitId !== payload.unitId) return Response.json({ error: "Occupant and property selection is invalid." }, { status: 404 });
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
          eq(bills.ownerId, ownedTenant.ownerId),
        )).limit(1);
      if (existingBill) {
        return Response.json(
          { error: "A bill already exists for this occupant and month." },
          { status: 409 },
        );
      }
      const [bill] = await db.update(bills).set({
        ownerId: ownedTenant.ownerId,
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
      }).where(administrator ? eq(bills.id, payload.id) : and(eq(bills.id, payload.id), eq(bills.ownerId, ownerId))).returning();
      return bill ? Response.json({ bill }) : Response.json({ error: "Bill not found." }, { status: 404 });
    }

    if (payload.action === "markPaid" && payload.id) {
      const [bill] = await db.update(bills).set({
        status: "Paid",
        paidAt: new Date(),
      }).where(administrator ? eq(bills.id, payload.id) : and(eq(bills.id, payload.id), eq(bills.ownerId, ownerId))).returning();
      return bill ? Response.json({ bill }) : Response.json({ error: "Bill not found." }, { status: 404 });
    }

    if (payload.action === "vacateTenant" && payload.id) {
      const [tenant] = await db.update(tenants).set({ active: false })
        .where(administrator ? eq(tenants.id, payload.id) : and(eq(tenants.id, payload.id), eq(tenants.ownerId, ownerId))).returning();
      return tenant ? Response.json({ tenant }) : Response.json({ error: "Occupant not found." }, { status: 404 });
    }

    if (payload.action === "deleteTenant" && payload.id) {
      const [tenant] = await db.select({ id: tenants.id, ownerId: tenants.ownerId }).from(tenants).where(administrator ? eq(tenants.id, payload.id) : and(eq(tenants.id, payload.id), eq(tenants.ownerId, ownerId))).limit(1);
      if (!tenant) return Response.json({ error: "Occupant not found." }, { status: 404 });
      await db.delete(bills).where(and(eq(bills.tenantId, payload.id), eq(bills.ownerId, tenant.ownerId)));
      await db.delete(tenants).where(eq(tenants.id, payload.id));
      return Response.json({ success: true });
    }

    if (payload.action === "deleteBill" && payload.id) {
      const [bill] = await db.delete(bills).where(administrator ? eq(bills.id, payload.id) : and(eq(bills.id, payload.id), eq(bills.ownerId, ownerId))).returning({ id: bills.id });
      return bill ? Response.json({ success: true }) : Response.json({ error: "Bill not found." }, { status: 404 });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save changes" },
      { status: 500 },
    );
  }
}
