export type GroceryInput = {
  name?: string; category?: string; unit?: string; quantity?: number;
  minimumStock?: number; unitPrice?: number; purchasedBy?: string; expiryDate?: string | null; notes?: string;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
export const validPassword = (password: string) =>
  password.length >= 8 && password.length <= 128 && /[A-Za-z]/.test(password) && /\d/.test(password);
export const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function validIsoDate(value: string | null | undefined) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function validateGroceryItem(payload: GroceryInput) {
  if (!payload.name?.trim() || payload.name.trim().length > 100) return "Item name is required and must be at most 100 characters.";
  if (!payload.category?.trim() || payload.category.trim().length > 60) return "Category is required and must be at most 60 characters.";
  if (!payload.unit?.trim() || payload.unit.trim().length > 30) return "Unit is required and must be at most 30 characters.";
  if (!finite(payload.quantity) || payload.quantity < 0 || payload.quantity > 999999999) return "Quantity must be a non-negative number.";
  if (!finite(payload.minimumStock) || payload.minimumStock < 0 || payload.minimumStock > 999999999) return "Minimum stock must be a non-negative number.";
  if (!finite(payload.unitPrice) || payload.unitPrice < 0 || payload.unitPrice > 999999999) return "Unit price must be a non-negative number.";
  if (!payload.purchasedBy?.trim() || payload.purchasedBy.trim().length > 80) return "Purchaser name is required and must be at most 80 characters.";
  if (!validIsoDate(payload.expiryDate)) return "Expiry date must be a valid date.";
  if ((payload.notes?.length ?? 0) > 500) return "Notes must be at most 500 characters.";
  return null;
}
