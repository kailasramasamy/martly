/**
 * LOCAL TEST DATA: list every generic catalog product (tag "generic") in all ACTIVE stores so the app shows them.
 * Prices come from prisma/data/generic-catalog-test-rates.json (rate per kg / L / unit) with a small per-store
 * variation; stock is random. Real stores set their own prices — this script refuses to run against a non-local DB
 * unless ALLOW_REMOTE_TEST_LISTINGS=1 (only while prod holds demo stores).
 *
 * Run: cd apps/api && npx tsx prisma/seed-generic-store-listings.ts
 */

import { PrismaClient, UnitType } from "../generated/prisma/index.js";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config();

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
if (!isLocal && process.env.ALLOW_REMOTE_TEST_LISTINGS !== "1") {
  throw new Error("Test listings are local-only: point DATABASE_URL at localhost or set ALLOW_REMOTE_TEST_LISTINGS=1");
}

const prisma = new PrismaClient();
const RATES: Record<string, number> = JSON.parse(
  readFileSync(new URL("./data/generic-catalog-test-rates.json", import.meta.url), "utf8"),
);

// Quantity of the variant in the rate's base unit (kg, L or unit)
const BASE_FACTOR: Record<UnitType, number> = {
  GRAM: 0.001, KG: 1, ML: 0.001, LITER: 1, PIECE: 1, PACK: 1, DOZEN: 12, BUNDLE: 1,
};

// Stable ±5% per store so stores don't all charge identical prices
function storeMultiplier(storeId: string): number {
  const n = [...storeId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return 0.95 + (n % 11) / 100;
}

async function main() {
  const stores = await prisma.store.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  const products = await prisma.product.findMany({
    where: { tags: { has: "generic" }, organizationId: null },
    include: { variants: true },
  });
  const unpriced = products.filter((p) => RATES[p.name] == null).map((p) => p.name);
  if (unpriced.length) throw new Error(`No test rate for: ${unpriced.join(", ")}`);

  let rows = 0;
  for (const store of stores) {
    const mult = storeMultiplier(store.id);
    const ops = products.flatMap((p) => p.variants.map((v) => {
      const price = Math.max(1, Math.round(RATES[p.name] * BASE_FACTOR[v.unitType] * Number(v.unitValue) * mult));
      const data = { price, stock: 20 + Math.floor(Math.random() * 181), isActive: true };
      return prisma.storeProduct.upsert({
        where: { storeId_variantId: { storeId: store.id, variantId: v.id } },
        create: { storeId: store.id, productId: p.id, variantId: v.id, ...data },
        update: data,
      });
    }));
    await prisma.$transaction(ops);
    rows += ops.length;
    console.log(`  ${store.name}: ${ops.length} listings`);
  }
  console.log(`✔ ${rows} store_products upserted for ${products.length} generic products across ${stores.length} stores`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
