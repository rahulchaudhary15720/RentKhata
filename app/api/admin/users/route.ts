import { asc, eq } from "drizzle-orm";
import { generateTemporaryPassword, hashPassword, requireRole } from "@/app/lib/auth";
import { getDb } from "@/db";
import { bills, groceryItems, groceryTransactions, sessions, tenants, units, users } from "@/db/schema";

type AdminAction = {
  action?: "setRole" | "setActive" | "resetPassword" | "deleteUser";
  id?: number;
  role?: "Administrator" | "User";
  active?: boolean;
};

export async function GET() {
  try {
    const auth = await requireRole("Administrator");
    if (!auth.user) return auth.response;
    const rows = await getDb().select({
      id: users.id, name: users.name, email: users.email, role: users.role,
      active: users.active, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt,
    }).from(users).orderBy(asc(users.name));
    return Response.json({ users: rows });
  } catch {
    return Response.json({ error: "Unable to load user accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole("Administrator");
    if (!auth.user) return auth.response;
    const body = await request.json().catch(() => null) as AdminAction | null;
    if (!body?.id || !Number.isInteger(body.id)) return Response.json({ error: "A valid user account is required." }, { status: 400 });
    const db = getDb();
    const [target] = await db.select().from(users).where(eq(users.id, body.id)).limit(1);
    if (!target) return Response.json({ error: "User account not found." }, { status: 404 });

    if (body.action === "setRole") {
      if (!body.role || !["Administrator", "User"].includes(body.role)) return Response.json({ error: "Choose a valid role." }, { status: 400 });
      if (target.id === auth.user.id && body.role !== "Administrator") return Response.json({ error: "You cannot remove your own administrator role." }, { status: 409 });
      const [user] = await db.update(users).set({ role: body.role }).where(eq(users.id, target.id)).returning({ id: users.id, role: users.role });
      return Response.json({ user });
    }

    if (body.action === "setActive") {
      if (typeof body.active !== "boolean") return Response.json({ error: "Choose whether the account is active." }, { status: 400 });
      if (target.id === auth.user.id && !body.active) return Response.json({ error: "You cannot deactivate your own account." }, { status: 409 });
      const [user] = await db.update(users).set({ active: body.active }).where(eq(users.id, target.id)).returning({ id: users.id, active: users.active });
      if (!body.active) await db.delete(sessions).where(eq(sessions.userId, target.id));
      return Response.json({ user });
    }

    if (body.action === "resetPassword") {
      if (target.id === auth.user.id) return Response.json({ error: "Use the account password-change screen to update your own password." }, { status: 409 });
      const temporaryPassword = generateTemporaryPassword();
      await db.update(users).set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true }).where(eq(users.id, target.id));
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      return Response.json({ temporaryPassword });
    }

    if (body.action === "deleteUser") {
      if (target.id === auth.user.id) return Response.json({ error: "You cannot delete your own account." }, { status: 409 });
      await db.delete(groceryTransactions).where(eq(groceryTransactions.ownerId, target.id));
      await db.delete(groceryItems).where(eq(groceryItems.ownerId, target.id));
      await db.delete(bills).where(eq(bills.ownerId, target.id));
      await db.delete(tenants).where(eq(tenants.ownerId, target.id));
      await db.delete(units).where(eq(units.ownerId, target.id));
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      await db.delete(users).where(eq(users.id, target.id));
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unsupported administrator action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update the user account." }, { status: 500 });
  }
}
