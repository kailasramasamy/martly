/**
 * Merge duplicate master produce products (data/produce-merge.json: duplicate name → keeper name) into their keeper,
 * then delete the duplicates and the placeholder brands they carried. Store listings move onto the keeper's
 * matching pack size (created when the keeper lacks it), keeping price and stock; a store already listing that
 * size gets the stock added and the stock history moved. Wishlists, collections, picks etc. follow the product.
 *
 * Dry run: cd apps/api && npx tsx prisma/merge-duplicate-produce.ts
 * Apply:   ... --apply --backup <file.json>   (prefix DATABASE_URL=<prod url> for prod)
 */

import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

type Tx = Prisma.TransactionClient;

const MERGE: Record<string, string> = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "data/produce-merge.json"), "utf8"),
);
const PLACEHOLDER_BRANDS = ["Farm Fresh", "Fresh Produce", "Imported", "Organic Farm"];

// Product-level references and the column that makes each row unique alongside product_id
const PRODUCT_REFS: [table: string, parent: string | null][] = [
  ["collection_items", "collection_id"], ["wishlist_items", "user_id"], ["reviews", "user_id"],
  ["recipe_items", "recipe_id"], ["store_post_products", "post_id"], ["store_picks", "store_id"],
  ["search_aliases", null], ["search_events", null], ["catalog_drafts", null],
];
const LISTING_REFS = [
  "stock_movements", "promo_price_changes", "stock_count_lines", "basket_add_ons",
  "subscription_items", "subscription_item_overrides", "order_items",
];

const prisma = new PrismaClient();
const sizeKey = (name: string) => name.toLowerCase().replace(/\bpcs\b/g, "pc").replace(/\s+/g, "");
const pcsLabel = (name: string) => name.replace(/^(\d+) pcs?$/, (_, n) => `${n} ${n === "1" ? "pc" : "pcs"}`);

async function masterId(tx: Tx, name: string): Promise<string> {
  const found = await tx.product.findMany({ where: { name, organizationId: null }, select: { id: true } });
  if (found.length !== 1) throw new Error(`expected one master product named "${name}", found ${found.length}`);
  return found[0].id;
}

// Keeper variant for each duplicate variant, matched by pack size; a missing size is added to the keeper
async function mapVariants(tx: Tx, dupId: string, keeperId: string, log: string[]): Promise<Map<string, string>> {
  const [dupVariants, keeperVariants] = await Promise.all([
    tx.productVariant.findMany({ where: { productId: dupId } }),
    tx.productVariant.findMany({ where: { productId: keeperId } }),
  ]);
  const map = new Map<string, string>();
  for (const v of dupVariants) {
    let target = keeperVariants.find((k) => sizeKey(k.name) === sizeKey(v.name));
    if (!target) {
      target = await tx.productVariant.create({
        data: { productId: keeperId, name: pcsLabel(v.name), unitType: v.unitType, unitValue: v.unitValue, mrp: v.mrp, packType: v.packType },
      });
      keeperVariants.push(target);
      log.push(`    + size "${target.name}" added`);
    }
    map.set(v.id, target.id);
  }
  return map;
}

async function moveListings(tx: Tx, keeperId: string, variants: Map<string, string>, log: string[]) {
  for (const [dupVariantId, keeperVariantId] of variants) {
    const listings = await tx.storeProduct.findMany({ where: { variantId: dupVariantId } });
    for (const sp of listings) {
      const existing = await tx.storeProduct.findUnique({ where: { storeId_variantId: { storeId: sp.storeId, variantId: keeperVariantId } } });
      if (!existing) {
        await tx.storeProduct.update({ where: { id: sp.id }, data: { productId: keeperId, variantId: keeperVariantId } });
        continue;
      }
      await tx.storeProduct.update({ where: { id: existing.id }, data: { stock: { increment: sp.stock } } });
      for (const table of LISTING_REFS) {
        await tx.$executeRawUnsafe(`UPDATE ${table} SET store_product_id = $1 WHERE store_product_id = $2`, existing.id, sp.id);
      }
      await tx.storeProduct.delete({ where: { id: sp.id } });
      log.push(`    store ${sp.storeId.slice(0, 8)}: stock ${sp.stock} folded into existing listing`);
    }
    await tx.$executeRawUnsafe(
      `UPDATE order_items SET product_id = $1, variant_id = $2 WHERE variant_id = $3`, keeperId, keeperVariantId, dupVariantId);
    await tx.$executeRawUnsafe(
      `DELETE FROM monthly_list_items WHERE variant_id = $1 AND list_id IN (SELECT list_id FROM monthly_list_items WHERE variant_id = $2)`,
      dupVariantId, keeperVariantId);
    await tx.$executeRawUnsafe(
      `UPDATE monthly_list_items SET product_id = $1, variant_id = $2 WHERE variant_id = $3`, keeperId, keeperVariantId, dupVariantId);
  }
}

async function moveProductRefs(tx: Tx, dupId: string, keeperId: string) {
  for (const [table, parent] of PRODUCT_REFS) {
    if (parent) {
      await tx.$executeRawUnsafe(
        `DELETE FROM ${table} WHERE product_id = $1 AND ${parent} IN (SELECT ${parent} FROM ${table} WHERE product_id = $2)`,
        dupId, keeperId);
    }
    await tx.$executeRawUnsafe(`UPDATE ${table} SET product_id = $1 WHERE product_id = $2`, keeperId, dupId);
  }
}

async function backup(path: string) {
  const products = await prisma.product.findMany({
    where: { name: { in: Object.keys(MERGE) }, organizationId: null },
    include: { variants: true, storeProducts: true },
  });
  const brands = await prisma.brand.findMany({ where: { name: { in: PLACEHOLDER_BRANDS } } });
  writeFileSync(path, JSON.stringify({ products, brands }, null, 2));
  console.log(`Backup: ${products.length} products, ${brands.length} brands → ${path}`);
}

async function mergeOne(tx: Tx, dupName: string, keeperName: string): Promise<string[]> {
  const log = [`${dupName} → ${keeperName}`];
  const [dupId, keeperId] = [await masterId(tx, dupName), await masterId(tx, keeperName)];
  const variants = await mapVariants(tx, dupId, keeperId, log);
  await moveListings(tx, keeperId, variants, log);
  await moveProductRefs(tx, dupId, keeperId);
  await tx.product.delete({ where: { id: dupId } });
  return log;
}

async function deleteBrands(tx: Tx): Promise<string[]> {
  const brands = await tx.brand.deleteMany({ where: { name: { in: PLACEHOLDER_BRANDS } } });
  return [`Deleted ${brands.count} placeholder brands`];
}

class DryRun extends Error {}

// Each duplicate merges in its own transaction (one long transaction times out over the Railway proxy);
// a dry run rolls every one back
async function run(apply: boolean, step: (tx: Tx) => Promise<string[]>) {
  try {
    await prisma.$transaction(async (tx) => {
      console.log((await step(tx)).join("\n"));
      if (!apply) throw new DryRun();
    }, { timeout: 60_000, maxWait: 30_000 });
  } catch (err) {
    if (!(err instanceof DryRun)) throw err;
  }
}

async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, backup: { type: "string" } } });
  if (values.apply && !values.backup) throw new Error("--apply needs --backup <file.json>");
  console.log(`${values.apply ? "Merging" : "Dry run"} on ${new URL(process.env.DATABASE_URL!).host}`);
  if (values.apply) await backup(values.backup!);
  for (const [dupName, keeperName] of Object.entries(MERGE)) {
    await run(values.apply!, (tx) => mergeOne(tx, dupName, keeperName));
  }
  await run(values.apply!, deleteBrands);
  console.log(values.apply ? `Merged ${Object.keys(MERGE).length} duplicates` : "Dry run: rolled back");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
