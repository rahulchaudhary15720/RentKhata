import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/app/lib/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  try {
    const auth = await requireRole("Administrator");
    if (!auth.user) return auth.response;
    const rows = await getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt }).from(users).orderBy(asc(users.name));
    return Response.json({ users: rows });
  } catch {
    return Response.json({ error: "Unable to load user accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole("Administrator");
    if (!auth.user) return auth.response;
    const body = await request.json().catch(() => null) as { id?: number; role?: "Administrator" | "Manager" } | null;
    if (!body?.id || !Number.isInteger(body.id) || !["Administrator", "Manager"].includes(body.role ?? "")) return Response.json({ error: "A valid account and role are required." }, { status: 400 });
    if (body.id === auth.user.id && body.role !== "Administrator") return Response.json({ error: "You cannot remove your own administrator role." }, { status: 409 });
    const [user] = await getDb().update(users).set({ role: body.role! }).where(eq(users.id, body.id)).returning({ id: users.id, name: users.name, email: users.email, role: users.role });
    return user ? Response.json({ user }) : Response.json({ error: "User account not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "Unable to update the account role." }, { status: 500 });
  }
}
