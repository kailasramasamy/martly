/**
 * TEST DATA: list every master product of one brand in all ACTIVE stores, priced at MRP minus a discount
 * (default 5%, roughly the brand's own online price), with random stock. Variants without an MRP are skipped.
 * Refuses a non-local DB unless ALLOW_REMOTE_TEST_LISTINGS=1 (only while prod holds demo stores).
 * --missing-only lists just the sizes a store doesn't carry yet, leaving existing listings' price and stock alone.
 * --stores "<name>,<name>" limits it to those ACTIVE stores (default: all of them).
 *
 * Run: cd apps/api && npx tsx prisma/seed-brand-store-listings.ts Aachi [--discount 5] [--missing-only] [--stores "Harur Fresh Mart"]
 */

import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";
import { parseArgs } from "node:util";

dotenv.config();

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
if (!isLocal && process.env.ALLOW_REMOTE_TEST_LISTINGS !== "1") {
  throw new Error("Test listings are local-only: point DATABASE_URL at localhost or set ALLOW_REMOTE_TEST_LISTINGS=1");
}

const prisma = new PrismaClient();
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { discount: { type: "string", default: "5" }, "missing-only": { type: "boolean", default: false }, stores: { type: "string" } },
});

async function main() {
  const [brandName] = positionals;
  if (!brandName) throw new Error("Usage: seed-brand-store-listings.ts <brand name> [--discount 5] [--missing-only] [--stores \"<name>,…\"]");
  const brand = await prisma.brand.findFirstOrThrow({ where: { name: brandName } });
  const factor = 1 - Number(values.discount) / 100;
  const storeNames = values.stores?.split(",").map((n) => n.trim()).filter(Boolean);
  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE", ...(storeNames && { name: { in: storeNames } }) }, select: { id: true, name: true },
  });
  const missing = storeNames?.filter((n) => !stores.some((s) => s.name === n)) ?? [];
  if (missing.length) throw new Error(`No ACTIVE store named: ${missing.join(", ")}`);
  const variants = await prisma.productVariant.findMany({
    where: { mrp: { not: null }, product: { brandId: brand.id, organizationId: null } },
    select: { id: true, productId: true, mrp: true },
  });

  const listing = (storeId: string, v: (typeof variants)[number]) => ({
    storeId, productId: v.productId, variantId: v.id,
    price: Math.round(Number(v.mrp) * factor), stock: 20 + Math.floor(Math.random() * 181), isActive: true,
  });
  for (const store of stores) {
    if (values["missing-only"]) {
      // One insert per store; sizes the store already lists are skipped, never touched
      const { count } = await prisma.storeProduct.createMany({ data: variants.map((v) => listing(store.id, v)), skipDuplicates: true });
      console.log(`  ${store.name}: ${count} new listings`);
      continue;
    }
    await prisma.$transaction(variants.map((v) => {
      const { storeId, productId, variantId, ...data } = listing(store.id, v);
      return prisma.storeProduct.upsert({
        where: { storeId_variantId: { storeId, variantId } },
        create: { storeId, productId, variantId, ...data },
        update: data,
      });
    }));
    console.log(`  ${store.name}: ${variants.length} listings`);
  }
  console.log(`✔ ${brand.name}: ${variants.length} pack sizes listed in ${stores.length} stores at MRP -${values.discount}%`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
