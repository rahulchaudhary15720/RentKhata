import { eq } from "drizzle-orm";
import { getDb, initializeDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, normalizeEmail, validEmail, verifyPassword } from "@/app/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
    const email = normalizeEmail(body?.email ?? "");
    const password = body?.password ?? "";
    if (!validEmail(email) || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });
    await initializeDb();
    const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    await createSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword } });
  } catch {
    return Response.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
