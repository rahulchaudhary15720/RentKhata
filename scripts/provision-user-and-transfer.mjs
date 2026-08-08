import { neon } from "@neondatabase/serverless";
import { randomBytes, randomInt, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const targetEmail = process.argv[2]?.trim().toLowerCase();
const targetName = process.argv[3]?.trim();
const sourceAdminEmail = process.argv[4]?.trim().toLowerCase();
if (!targetEmail || !targetName || !sourceAdminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
  console.error("Usage: node --env-file=.env scripts/provision-user-and-transfer.mjs <target-email> <target-name> <source-admin-email>");
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

await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'User'`;
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`;
await sql`UPDATE users SET role = 'User' WHERE role = 'Manager'`;
await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('Administrator', 'User'))`;

const [source] = await sql`SELECT id, email FROM users WHERE email = ${sourceAdminEmail} AND role = 'Administrator' LIMIT 1`;
if (!source) throw new Error(`Administrator account ${sourceAdminEmail} was not found.`);

const [target] = await sql`INSERT INTO users (name, email, password_hash, role, must_change_password, active)
  VALUES (${targetName}, ${targetEmail}, ${passwordHash}, 'User', TRUE, TRUE)
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
    role = 'User', must_change_password = TRUE, active = TRUE
  RETURNING id, email`;

const [, units, tenants, bills, groceryItems, groceryTransactions] = await sql.transaction([
  sql`DELETE FROM sessions WHERE user_id = ${target.id}`,
  sql`UPDATE units SET owner_id = ${target.id} WHERE owner_id = ${source.id} RETURNING id`,
  sql`UPDATE tenants SET owner_id = ${target.id} WHERE owner_id = ${source.id} RETURNING id`,
  sql`UPDATE bills SET owner_id = ${target.id} WHERE owner_id = ${source.id} RETURNING id`,
  sql`UPDATE grocery_items SET owner_id = ${target.id} WHERE owner_id = ${source.id} RETURNING id`,
  sql`UPDATE grocery_transactions SET owner_id = ${target.id} WHERE owner_id = ${source.id} RETURNING id`,
]);

console.log(`User: ${target.email}`);
console.log(`Temporary password: ${temporaryPassword}`);
console.log("Password change required: yes");
console.log(`Transferred records: units=${units.length}, occupants=${tenants.length}, bills=${bills.length}, groceryItems=${groceryItems.length}, groceryTransactions=${groceryTransactions.length}`);
