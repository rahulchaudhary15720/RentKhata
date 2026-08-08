import test from "node:test";
import assert from "node:assert/strict";
import { finite, normalizeEmail, validEmail, validIsoDate, validPassword, validateGroceryItem } from "../app/lib/validation.ts";

const validItem = { name: "Rice", category: "Grains", unit: "kg", quantity: 10, minimumStock: 2, unitPrice: 70, expiryDate: "2027-02-28", notes: "Dry shelf" };

test("normalizes email without changing internal characters", () => assert.equal(normalizeEmail("  Owner@Example.COM "), "owner@example.com"));
test("email validation rejects missing domains, whitespace and overlong input", () => {
  assert.equal(validEmail("owner@example.com"), true); assert.equal(validEmail("owner@"), false);
  assert.equal(validEmail("a b@example.com"), false); assert.equal(validEmail(`${"a".repeat(250)}@x.com`), false);
});
test("password requires bounds, a letter and a number", () => {
  assert.equal(validPassword("strong123"), true); assert.equal(validPassword("onlyletters"), false);
  assert.equal(validPassword("12345678"), false); assert.equal(validPassword("a1short"), false); assert.equal(validPassword(`a1${"x".repeat(127)}`), false);
});
test("ISO date validation catches format errors and impossible leap/calendar dates", () => {
  assert.equal(validIsoDate(null), true); assert.equal(validIsoDate("2028-02-29"), true);
  assert.equal(validIsoDate("2027-02-29"), false); assert.equal(validIsoDate("2026-04-31"), false); assert.equal(validIsoDate("08-08-2026"), false);
});
test("finite accepts real numbers only", () => {
  assert.equal(finite(0), true); assert.equal(finite(-2.5), true); assert.equal(finite("2"), false); assert.equal(finite(NaN), false); assert.equal(finite(Infinity), false);
});
test("valid grocery item passes including zero quantities", () => {
  assert.equal(validateGroceryItem(validItem), null); assert.equal(validateGroceryItem({ ...validItem, quantity: 0, minimumStock: 0, unitPrice: 0 }), null);
});
test("grocery validation rejects blank and oversized text", () => {
  assert.match(validateGroceryItem({ ...validItem, name: "   " })!, /name/i); assert.match(validateGroceryItem({ ...validItem, category: "x".repeat(61) })!, /category/i);
  assert.match(validateGroceryItem({ ...validItem, unit: "x".repeat(31) })!, /unit/i); assert.match(validateGroceryItem({ ...validItem, notes: "x".repeat(501) })!, /notes/i);
});
test("grocery validation rejects negative, non-finite and excessive numbers", () => {
  assert.match(validateGroceryItem({ ...validItem, quantity: -1 })!, /quantity/i); assert.match(validateGroceryItem({ ...validItem, minimumStock: NaN })!, /minimum/i);
  assert.match(validateGroceryItem({ ...validItem, unitPrice: Infinity })!, /price/i); assert.match(validateGroceryItem({ ...validItem, quantity: 1_000_000_000 })!, /quantity/i);
});
