import { eq } from "drizzle-orm";
import { getDb, initializeDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, normalizeEmail, validEmail, validPassword } from "@/app/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { name?: string; email?: string; password?: string } | null;
    const name = body?.name?.trim() ?? "";
    const email = normalizeEmail(body?.email ?? "");
    const password = body?.password ?? "";
    if (name.length < 2 || name.length > 80) return Response.json({ error: "Name must be between 2 and 80 characters." }, { status: 400 });
    if (!validEmail(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!validPassword(password)) return Response.json({ error: "Password must be 8–128 characters and include a letter and a number." }, { status: 400 });

    await initializeDb();
    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    const [user] = await db.insert(users).values({ name, email, passwordHash: await hashPassword(password), role: "User" }).returning({ id: users.id, name: users.name, email: users.email, role: users.role, mustChangePassword: users.mustChangePassword });
    await createSession(user.id);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    if (message.includes("users_email_idx") || message.includes("duplicate key")) return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    return Response.json({ error: "Unable to create account right now." }, { status: 500 });
  }
}
