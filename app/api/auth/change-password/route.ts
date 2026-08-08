import { eq } from "drizzle-orm";
import { createSession, getCurrentUser, hashPassword, validPassword, verifyPassword } from "@/app/lib/auth";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
    const body = await request.json().catch(() => null) as { currentPassword?: string; newPassword?: string } | null;
    const currentPassword = body?.currentPassword ?? "";
    const newPassword = body?.newPassword ?? "";
    if (!currentPassword) return Response.json({ error: "Enter your temporary or current password." }, { status: 400 });
    if (!validPassword(newPassword)) return Response.json({ error: "New password must be 8–128 characters and include a letter and a number." }, { status: 400 });
    if (currentPassword === newPassword) return Response.json({ error: "Your new password must be different from the current password." }, { status: 400 });
    const db = getDb();
    const [account] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) return Response.json({ error: "Current password is incorrect." }, { status: 401 });
    await db.update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false }).where(eq(users.id, account.id));
    await db.delete(sessions).where(eq(sessions.userId, account.id));
    await createSession(account.id);
    return Response.json({ user: { id: account.id, name: account.name, email: account.email, role: account.role, mustChangePassword: false } });
  } catch {
    return Response.json({ error: "Unable to change your password right now." }, { status: 500 });
  }
}
