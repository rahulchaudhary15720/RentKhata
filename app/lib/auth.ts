import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, initializeDb } from "@/db";
import { sessions, users } from "@/db/schema";
export { normalizeEmail, validEmail, validPassword } from "./validation";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "rentkhata_session";
const SESSION_DAYS = 30;

export type UserRole = "Administrator" | "Manager";
export type SafeUser = { id: number; name: string; email: string; role: UserRole; mustChangePassword: boolean };

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(sessions).values({ userId, tokenHash: tokenHash(token), expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  await initializeDb();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  await initializeDb();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role, mustChangePassword: users.mustChangePassword })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: Response.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (user.mustChangePassword) return { user: null, response: Response.json({ error: "Change your temporary password before continuing." }, { status: 428 }) };
  return { user, response: null };
}

export async function requireRole(role: UserRole) {
  const auth = await requireUser();
  if (!auth.user || auth.user.role !== role) {
    return { user: null, response: auth.response ?? Response.json({ error: "You do not have permission to perform this action." }, { status: 403 }) };
  }
  return auth;
}
