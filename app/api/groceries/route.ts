import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { requireUser } from "@/app/lib/auth";
import { getDb, getSqlClient } from "@/db";
import { groceryItems, groceryTransactions, users } from "@/db/schema";
import { finite, validateGroceryItem } from "@/app/lib/validation";

type Payload = {
  action?: string; id?: number; ownerId?: number; name?: string; category?: string; unit?: string;
  quantity?: number; minimumStock?: number; unitPrice?: number; expiryDate?: string | null;
  purchasedBy?: string; notes?: string; direction?: "in" | "out"; note?: string;
};

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const db = getDb();
    const administrator = auth.user.role === "Administrator";
    const [items, transactions, owners] = await Promise.all([
      db.select().from(groceryItems).where(administrator ? undefined : eq(groceryItems.ownerId, auth.user.id)).orderBy(asc(groceryItems.name)),
      db.select().from(groceryTransactions).where(administrator ? undefined : eq(groceryTransactions.ownerId, auth.user.id)).orderBy(desc(groceryTransactions.createdAt)).limit(250),
      administrator ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)) : Promise.resolve([]),
    ]);
    return Response.json({ items, transactions, owners });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load groceries." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const payload = await request.json().catch(() => null) as Payload | null;
    if (!payload) return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    const db = getDb();
    const ownerId = auth.user.id;
    const administrator = auth.user.role === "Administrator";
    const targetOwnerId = administrator && payload.ownerId ? payload.ownerId : ownerId;

    if (payload.action === "addItem" || payload.action === "updateItem") {
      const validation = validateGroceryItem(payload);
      if (validation) return Response.json({ error: validation }, { status: 400 });
      const values = {
        name: payload.name!.trim(), category: payload.category!.trim(), unit: payload.unit!.trim(),
        quantity: payload.quantity!, minimumStock: payload.minimumStock!, unitPrice: payload.unitPrice!,
        purchasedBy: payload.purchasedBy!.trim(), expiryDate: payload.expiryDate || null, notes: payload.notes?.trim() ?? "", updatedAt: new Date(),
      };
      const [existingItem] = payload.action === "updateItem" && payload.id
        ? await db.select({ id: groceryItems.id, ownerId: groceryItems.ownerId, quantity: groceryItems.quantity }).from(groceryItems)
          .where(administrator ? eq(groceryItems.id, payload.id) : and(eq(groceryItems.id, payload.id), eq(groceryItems.ownerId, ownerId))).limit(1)
        : [];
      if (payload.action === "updateItem" && !existingItem) return Response.json({ error: "Grocery item not found." }, { status: 404 });
      if (payload.action === "addItem" && administrator && payload.ownerId) {
        const [target] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, payload.ownerId), eq(users.active, true))).limit(1);
        if (!target) return Response.json({ error: "Selected record owner was not found or is inactive." }, { status: 404 });
      }
      const recordOwnerId = existingItem?.ownerId ?? targetOwnerId;
      const [duplicate] = await db.select({ id: groceryItems.id }).from(groceryItems).where(and(
        eq(groceryItems.ownerId, recordOwnerId),
        sql`lower(${groceryItems.name}) = lower(${values.name})`,
        payload.action === "updateItem" && payload.id ? ne(groceryItems.id, payload.id) : sql`true`,
      )).limit(1);
      if (duplicate) return Response.json({ error: "An item with this name already exists." }, { status: 409 });

      if (payload.action === "addItem") {
        const [item] = await db.insert(groceryItems).values({ ownerId: targetOwnerId, ...values }).returning();
        if (item.quantity > 0) await db.insert(groceryTransactions).values({ ownerId: targetOwnerId, itemId: item.id, type: "Stock in", quantityChange: item.quantity, personName: item.purchasedBy, note: "Opening stock" });
        return Response.json({ item }, { status: 201 });
      }
      if (!payload.id || !Number.isInteger(payload.id)) return Response.json({ error: "A valid item id is required." }, { status: 400 });
      const [current] = await db.select().from(groceryItems).where(administrator ? eq(groceryItems.id, payload.id) : and(eq(groceryItems.id, payload.id), eq(groceryItems.ownerId, ownerId))).limit(1);
      if (!current) return Response.json({ error: "Grocery item not found." }, { status: 404 });
      const [item] = await db.update(groceryItems).set(values).where(administrator ? eq(groceryItems.id, payload.id) : and(eq(groceryItems.id, payload.id), eq(groceryItems.ownerId, ownerId))).returning();
      const change = item.quantity - current.quantity;
      if (change !== 0) await db.insert(groceryTransactions).values({ ownerId: item.ownerId, itemId: item.id, type: "Correction", quantityChange: change, personName: item.purchasedBy, note: "Quantity changed while editing item" });
      return Response.json({ item });
    }

    if (payload.action === "adjustStock") {
      if (!payload.id || !Number.isInteger(payload.id)) return Response.json({ error: "A valid item id is required." }, { status: 400 });
      if (payload.direction !== "in" && payload.direction !== "out") return Response.json({ error: "Choose stock in or stock out." }, { status: 400 });
      if (!finite(payload.quantity) || payload.quantity! <= 0 || payload.quantity! > 999999999) return Response.json({ error: "Adjustment quantity must be greater than zero." }, { status: 400 });
      if ((payload.note?.length ?? 0) > 300) return Response.json({ error: "Adjustment note must be at most 300 characters." }, { status: 400 });
      if (payload.direction === "in" && (!payload.purchasedBy?.trim() || payload.purchasedBy.trim().length > 80)) return Response.json({ error: "Purchaser name is required and must be at most 80 characters." }, { status: 400 });
      const delta = payload.direction === "in" ? payload.quantity! : -payload.quantity!;
      const type = payload.direction === "in" ? "Stock in" : "Stock out";
      const adjusted = await getSqlClient()`WITH updated AS (
        UPDATE grocery_items
        SET quantity = quantity + ${delta},
            purchased_by = CASE WHEN ${payload.direction} = 'in' THEN ${payload.purchasedBy?.trim() ?? ""} ELSE purchased_by END,
            updated_at = NOW()
        WHERE id = ${payload.id} AND (${administrator} OR owner_id = ${ownerId}) AND quantity + ${delta} >= 0
        RETURNING id, owner_id
      )
      INSERT INTO grocery_transactions (owner_id, item_id, type, quantity_change, person_name, note)
      SELECT owner_id, id, ${type}, ${delta}, ${payload.direction === "in" ? payload.purchasedBy!.trim() : ""}, ${payload.note?.trim() ?? ""} FROM updated
      RETURNING item_id`;
      if (!adjusted.length) {
        const [exists] = await db.select({ quantity: groceryItems.quantity }).from(groceryItems).where(administrator ? eq(groceryItems.id, payload.id) : and(eq(groceryItems.id, payload.id), eq(groceryItems.ownerId, ownerId))).limit(1);
        return Response.json({ error: exists ? `Only ${exists.quantity} units are available.` : "Grocery item not found." }, { status: exists ? 409 : 404 });
      }
      const [item] = await db.select().from(groceryItems).where(administrator ? eq(groceryItems.id, payload.id) : and(eq(groceryItems.id, payload.id), eq(groceryItems.ownerId, ownerId))).limit(1);
      return Response.json({ item });
    }

    if (payload.action === "deleteItem") {
      if (!payload.id || !Number.isInteger(payload.id)) return Response.json({ error: "A valid item id is required." }, { status: 400 });
      const [item] = await db.delete(groceryItems).where(administrator ? eq(groceryItems.id, payload.id) : and(eq(groceryItems.id, payload.id), eq(groceryItems.ownerId, ownerId))).returning({ id: groceryItems.id });
      return item ? Response.json({ success: true }) : Response.json({ error: "Grocery item not found." }, { status: 404 });
    }
    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save grocery changes.";
    if (message.includes("grocery_items_owner_name_idx") || message.includes("duplicate key")) return Response.json({ error: "An item with this name already exists." }, { status: 409 });
    return Response.json({ error: message }, { status: 500 });
  }
}
