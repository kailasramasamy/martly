import { STORE_BRAND_DEPARTMENT_SLUG } from "@martly/shared/constants";
import type { SaveLooseStaplesInput } from "@martly/shared/schemas";
import type { LooseStapleAisle, LooseStapleItem, LooseStaplePriceSource } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { recordOpeningStock } from "./stock-ledger.js";

// Loose goods sell a little under the branded packs beside them
const LOOSE_VS_BRANDED = 0.9;
// Grams and millilitres to the kilo or litre an aisle's going rate is worked out in
const TO_BASE: Record<string, number> = { KG: 1, GRAM: 0.001, LITER: 1, ML: 0.001 };

/** What a size's starting price is worked out from */
type PriceBasis = { variant_id: string; subcategory_id: string; unit_type: string; unit_value: unknown };
type StapleRow = PriceBasis & {
  product_id: string; name: string; size: string; image_url: string | null; subcategory: string; category: string;
  price: unknown; stock: number | null; is_active: boolean | null;
};
export type StartingPrice = { price: number; from: LooseStaplePriceSource };

// Unbranded staples the organisation may sell (Martly's master ones and its own), with this store's listing if any
function stapleRows(prisma: PrismaClient, store: { id: string; organizationId: string }, variantIds?: string[]) {
  return prisma.$queryRaw<StapleRow[]>`
    SELECT v.id AS variant_id, p.id AS product_id, p.name, v.name AS size, COALESCE(p.image_url, v.image_url) AS image_url,
      v.unit_type, v.unit_value, s.id AS subcategory_id, s.name AS subcategory, c.name AS category,
      sp.price, sp.stock, sp.is_active
    FROM products p
    JOIN product_variants v ON v.product_id = p.id
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id
    JOIN departments d ON d.id = c.department_id
    LEFT JOIN store_products sp ON sp.variant_id = v.id AND sp.store_id = ${store.id}
    WHERE d.slug = ${STORE_BRAND_DEPARTMENT_SLUG} AND p.brand_id IS NULL AND p.is_active
      AND (p.organization_id IS NULL OR p.organization_id = ${store.organizationId})
      ${variantIds ? Prisma.sql`AND v.id = ANY(${variantIds}::text[])` : Prisma.empty}
    ORDER BY c.sort_order, s.sort_order, p.name,
      v.unit_value * CASE v.unit_type WHEN 'GRAM' THEN 0.001 WHEN 'ML' THEN 0.001 ELSE 1 END NULLS LAST`;
}

// What Martly's reference (template) stores charge for each size
async function referencePrices(prisma: PrismaClient, variantIds: string[]) {
  const rows = await prisma.$queryRaw<{ variant_id: string; price: unknown }[]>`
    SELECT sp.variant_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY sp.price) AS price
    FROM store_products sp JOIN stores st ON st.id = sp.store_id JOIN organizations o ON o.id = st.organization_id
    WHERE o.is_template AND sp.variant_id = ANY(${variantIds}::text[])
    GROUP BY sp.variant_id`;
  return new Map(rows.map((r) => [r.variant_id, Number(r.price)]));
}

// The store's own going rate per kilo or litre for branded packs, aisle by aisle
async function aisleRates(prisma: PrismaClient, storeId: string, subcategoryIds: string[]) {
  const rows = await prisma.$queryRaw<{ subcategory_id: string; rate: unknown }[]>`
    SELECT p.subcategory_id, percentile_cont(0.5) WITHIN GROUP (
      ORDER BY sp.price / (v.unit_value * CASE v.unit_type WHEN 'GRAM' THEN 0.001 WHEN 'ML' THEN 0.001 ELSE 1 END)) AS rate
    FROM store_products sp JOIN products p ON p.id = sp.product_id JOIN product_variants v ON v.id = sp.variant_id
    WHERE sp.store_id = ${storeId} AND sp.is_active AND p.brand_id IS NOT NULL
      AND v.unit_type IN ('KG', 'GRAM', 'LITER', 'ML') AND v.unit_value > 0 AND p.subcategory_id = ANY(${subcategoryIds}::text[])
    GROUP BY p.subcategory_id`;
  return new Map(rows.map((r) => [r.subcategory_id, Number(r.rate)]));
}

function startingPrice(row: PriceBasis, reference: Map<string, number>, rates: Map<string, number>): StartingPrice | null {
  const ref = reference.get(row.variant_id);
  if (ref) return { price: Math.round(ref), from: "REFERENCE" };
  const rate = rates.get(row.subcategory_id);
  const amount = Number(row.unit_value) * (TO_BASE[row.unit_type] ?? 0);
  return rate && amount > 0 ? { price: Math.max(1, Math.round(rate * amount * LOOSE_VS_BRANDED)), from: "AISLE" } : null;
}

async function startingPrices(prisma: PrismaClient, storeId: string, rows: PriceBasis[]) {
  const [reference, rates] = await Promise.all([
    referencePrices(prisma, rows.map((r) => r.variant_id)),
    aisleRates(prisma, storeId, [...new Set(rows.map((r) => r.subcategory_id))]),
  ]);
  return new Map(rows.flatMap((r) => { const p = startingPrice(r, reference, rates); return p ? [[r.variant_id, p] as const] : []; }));
}

/** A starting price for each size that has something to go on: Martly's reference store, else the aisle's going rate */
export async function suggestPrices(prisma: PrismaClient, storeId: string, variantIds: string[]) {
  if (variantIds.length === 0) return new Map<string, StartingPrice>();
  const rows = await prisma.$queryRaw<PriceBasis[]>`
    SELECT v.id AS variant_id, p.subcategory_id, v.unit_type, v.unit_value
    FROM product_variants v JOIN products p ON p.id = v.product_id
    WHERE v.id = ANY(${variantIds}::text[]) AND p.subcategory_id IS NOT NULL`;
  return startingPrices(prisma, storeId, rows);
}

function toItem(row: StapleRow, prices: Map<string, StartingPrice>): LooseStapleItem {
  const listed = row.price === null ? null : { price: Number(row.price), stock: row.stock ?? 0, isActive: row.is_active ?? false };
  const start = prices.get(row.variant_id);
  return {
    variantId: row.variant_id, productId: row.product_id, name: row.name, size: row.size, imageUrl: row.image_url,
    listed, suggested: start?.price ?? null, suggestedFrom: start?.from ?? null,
  };
}

/** The store's loose staples by aisle: what it lists already, and a starting price for the rest */
export async function looseStaples(prisma: PrismaClient, store: { id: string; organizationId: string }): Promise<LooseStapleAisle[]> {
  const rows = await stapleRows(prisma, store);
  const prices = await startingPrices(prisma, store.id, rows);
  const aisles = new Map<string, LooseStapleAisle>();
  for (const row of rows) {
    const aisle = aisles.get(row.subcategory_id) ?? { subcategoryId: row.subcategory_id, name: row.subcategory, category: row.category, items: [] };
    aisle.items.push(toItem(row, prices));
    aisles.set(row.subcategory_id, aisle);
  }
  return [...aisles.values()];
}

/** Lists the new sizes at the owner's prices with opening stock, and reprices (and turns back on) ones already listed */
export async function saveLooseStaples(prisma: PrismaClient, store: { id: string; organizationId: string }, input: SaveLooseStaplesInput, userId: string) {
  const rows = await stapleRows(prisma, store, input.items.map((i) => i.variantId));
  const byVariant = new Map(rows.map((r) => [r.variant_id, r]));
  if (byVariant.size !== new Set(input.items.map((i) => i.variantId)).size) {
    throw Object.assign(new Error("Only the store's loose staples can be priced here"), { statusCode: 400 });
  }
  const fresh = input.items.filter((i) => byVariant.get(i.variantId)!.price === null);
  const repriced = input.items.filter((i) => byVariant.get(i.variantId)!.price !== null);
  await prisma.$transaction(async (tx) => {
    const created = await tx.storeProduct.createManyAndReturn({
      data: fresh.map((i) => ({ storeId: store.id, productId: byVariant.get(i.variantId)!.product_id, variantId: i.variantId, price: i.price, stock: input.openingStock, carried: true })),
      select: { id: true, storeId: true, stock: true },
    });
    await recordOpeningStock(tx, created, userId);
    for (const i of repriced) {
      await tx.storeProduct.update({ where: { storeId_variantId: { storeId: store.id, variantId: i.variantId } }, data: { price: i.price, isActive: true, carried: true } });
    }
  });
  return { listed: fresh.length, repriced: repriced.length };
}
