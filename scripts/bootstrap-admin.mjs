import { neon } from "@neondatabase/serverless";
import { randomBytes, randomInt, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const email = process.argv[2]?.trim().toLowerCase();
const name = process.argv[3]?.trim();
if (!email || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node --env-file=.env scripts/bootstrap-admin.mjs <email> <name>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
const required = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%"].map(set => set[randomInt(set.length)]);
const temporaryPassword = [...required, ...Array.from({ length: 16 }, () => alphabet[randomInt(alphabet.length)])]
  .sort(() => randomInt(3) - 1).join("");
const salt = randomBytes(16).toString("hex");
const derived = await promisify(scryptCallback)(temporaryPassword, salt, 64);
const passwordHash = `scrypt:${salt}:${Buffer.from(derived).toString("hex")}`;
const sql = neon(process.env.DATABASE_URL);

await sql`CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'User', must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'User'`;
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email)`;
const [admin] = await sql`INSERT INTO users (name, email, password_hash, role, must_change_password)
  VALUES (${name}, ${email}, ${passwordHash}, 'Administrator', TRUE)
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
    role = 'Administrator', must_change_password = TRUE
  RETURNING id, email`;

await sql`ALTER TABLE units ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
await sql`UPDATE units SET owner_id = ${admin.id} WHERE owner_id IS NULL`;
await sql`UPDATE tenants SET owner_id = ${admin.id} WHERE owner_id IS NULL`;
await sql`UPDATE bills SET owner_id = ${admin.id} WHERE owner_id IS NULL`;

console.log(`Administrator: ${admin.email}`);
console.log(`Temporary password: ${temporaryPassword}`);
console.log("Password change required: yes");
