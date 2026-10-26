import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { StoreSize } from "@martly/shared/constants";
import type { ApplyCatalogInput, CatalogRules } from "@martly/shared/schemas";
import type { ApplyCatalogResult, UnpricedItem } from "@martly/shared/types";
import { suggestPrices } from "../loose-staples.js";
import { recordOpeningStock } from "../stock-ledger.js";
import { proposeCatalog, proposedVariants } from "./catalog-proposal.js";

const CHUNK = 2000;

/** Proposed sizes with no MRP and no listing yet: loose staples the owner prices by hand */
export async function unpricedProposal(
  prisma: PrismaClient, store: { id: string; state: string | null; size: StoreSize }, rules: CatalogRules,
): Promise<UnpricedItem[]> {
  const { picks, taxonomy } = await proposeCatalog(prisma, store, rules);
  const listed = new Set((await prisma.storeProduct.findMany({ where: { storeId: store.id }, select: { variantId: true } })).map((r) => r.variantId));
  const aisleName = new Map(taxonomy.map((t) => [t.subcategory_id, t.subcategory]));
  return [...picks.entries()].filter(([, p]) => p.included).flatMap(([subcategoryId, p]) => p.picked.flatMap((c) =>
    c.variants.filter((v) => v.mrp === null && !listed.has(v.id)).map((v) => ({
      variantId: v.id, productName: c.name, variantName: v.name, aisle: aisleName.get(subcategoryId) ?? "",
    }))));
}

const sellingPrice = (mrp: number, discountPct: number) => Math.max(1, Math.round(mrp * (1 - discountPct / 100)));

type NewListing = { storeId: string; productId: string; variantId: string; price: number; stock: number };

async function createListings(prisma: PrismaClient, rows: NewListing[], userId: string) {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const created = await tx.storeProduct.createManyAndReturn({ data: rows.slice(i, i + CHUNK), select: { id: true, storeId: true, stock: true } });
      await recordOpeningStock(tx, created, userId);
    }
  }, { timeout: 120_000 });
}

/**
 * Makes the store's listings match the proposal: sizes it no longer proposes go, new ones with an MRP are listed at the
 * pricing rule with opening stock, and listings already there keep their price and stock (so hand-set prices survive).
 * Loose sizes (no MRP) are listed next at their suggested price, worked out once the branded packs set the aisle's rate;
 * only those with nothing to go on wait for a hand-entered price.
 */
export async function applyCatalog(
  prisma: PrismaClient,
  store: { id: string; state: string | null; size: StoreSize },
  input: ApplyCatalogInput,
  userId: string,
): Promise<ApplyCatalogResult> {
  const { picks } = await proposeCatalog(prisma, store, input);
  const proposed = proposedVariants(picks);
  const wanted = new Set(proposed.map((v) => v.variantId));
  const existing = await prisma.storeProduct.findMany({ where: { storeId: store.id }, select: { id: true, variantId: true } });
  const have = new Set(existing.map((e) => e.variantId));
  const removeIds = existing.filter((e) => !wanted.has(e.variantId)).map((e) => e.id);
  const toCreate = proposed.filter((v) => v.mrp !== null && !have.has(v.variantId)).map((v) => ({
    storeId: store.id, productId: v.productId, variantId: v.variantId,
    price: sellingPrice(v.mrp!, input.discountPct), stock: input.openingStock,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.storeProduct.deleteMany({ where: { id: { in: removeIds } } });
    await tx.store.update({ where: { id: store.id }, data: { catalogRules: input } });
  });
  await createListings(prisma, toCreate, userId);

  const loose = proposed.filter((v) => v.mrp === null && !have.has(v.variantId));
  const suggested = await suggestPrices(prisma, store.id, loose.map((v) => v.variantId));
  const looseRows = loose.flatMap((v) => {
    const start = suggested.get(v.variantId);
    return start ? [{ storeId: store.id, productId: v.productId, variantId: v.variantId, price: start.price, stock: input.openingStock }] : [];
  });
  await createListings(prisma, looseRows, userId);

  return {
    created: toCreate.length + looseRows.length,
    removed: removeIds.length,
    kept: existing.length - removeIds.length,
    needsPrice: loose.length - looseRows.length,
  };
}
