import type { FoodType, Prisma, StorageType } from "../../../generated/prisma/client.js";
import type { WebProductInfo } from "@martly/shared/types";

/** The product fields the product page's information sections are built from */
export const productInfoSelect = {
  description: true, foodType: true, ingredients: true, nutritionalInfo: true, allergens: true,
  shelfLifeDays: true, storageType: true, storageInstructions: true, usageInstructions: true, dangerWarnings: true,
  manufacturerName: true, countryOfOrigin: true, fssaiLicense: true,
} satisfies Prisma.ProductSelect;

type InfoRow = Prisma.ProductGetPayload<{ select: typeof productInfoSelect }>;
interface InfoContext { brand: string | null; category: string | null; packs: string[] }

const FOOD_TYPE: Record<FoodType, string> = { VEG: "Vegetarian", NON_VEG: "Non-vegetarian", VEGAN: "Vegan", EGG: "Contains egg" };
const STORAGE: Record<StorageType, string> = {
  AMBIENT: "Room temperature", COOL_DRY: "Cool and dry place", REFRIGERATED: "Refrigerated",
  DEEP_CHILLED: "Deep chilled", FROZEN: "Frozen", HUMIDITY_CONTROLLED: "Humidity controlled",
};
const PER_KEY = /^nutrition(al)?\s*(value\s*)?per$/i;

const rows = (pairs: [string, string | null | undefined][]) =>
  pairs.flatMap(([label, value]) => (value?.trim() ? [{ label, value: value.trim() }] : []));

/** "About this item": the description as short points, one per sentence or line */
function highlights(description: string | null) {
  if (!description?.trim()) return [];
  return description.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 2).slice(0, 6);
}

/** The nutrition table and its "per 100 g" basis; values that aren't text or numbers (rare imported shapes) are left out */
function nutrition(info: Prisma.JsonValue) {
  if (!info || typeof info !== "object" || Array.isArray(info)) return null;
  const entries = Object.entries(info).flatMap(([label, value]) =>
    typeof value === "string" || typeof value === "number" ? [[label.trim(), String(value)] as const] : []);
  const per = entries.find(([label]) => PER_KEY.test(label))?.[1] ?? null;
  const facts = entries.filter(([label]) => !PER_KEY.test(label)).map(([label, value]) => ({ label, value }));
  return facts.length ? { per, rows: facts } : null;
}

export function productInfo(p: InfoRow, ctx: InfoContext): WebProductInfo {
  const details = rows([
    ["Brand", ctx.brand ?? "Unbranded"],
    ["Category", ctx.category],
    ["Diet type", p.foodType && FOOD_TYPE[p.foodType]],
    ["Pack sizes", ctx.packs.join(", ")],
    ["Shelf life", p.shelfLifeDays ? `${p.shelfLifeDays} days` : null],
    ["Storage", p.storageType && STORAGE[p.storageType]],
    ["Allergens", p.allergens.join(", ")],
    ["Manufacturer", p.manufacturerName],
    ["FSSAI licence", p.fssaiLicense],
    ["Country of origin", p.countryOfOrigin],
  ]);
  const important = rows([
    ["Ingredients", p.ingredients],
    ["Directions", p.usageInstructions],
    ["Storage instructions", p.storageInstructions],
    ["Allergen information", p.allergens.length ? `Contains ${p.allergens.join(", ")}.` : null],
    ["Safety information", p.dangerWarnings],
  ]);
  return { highlights: highlights(p.description), details, nutrition: nutrition(p.nutritionalInfo), important };
}
