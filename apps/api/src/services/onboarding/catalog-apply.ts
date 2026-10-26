import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { StoreSize } from "@martly/shared/constants";
import type { ApplyCatalogInput, CatalogRules } from "@martly/shared/schemas";
import type { ApplyCatalogResult, UnpricedItem } from "@martly/shared/types";
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

/**
 * Makes the store's listings match the proposal: sizes it no longer proposes go, new ones with an MRP are listed at the
 * pricing rule with opening stock, and listings already there keep their price and stock (so hand-set prices survive).
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
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const rows = await tx.storeProduct.createManyAndReturn({
        data: toCreate.slice(i, i + CHUNK), select: { id: true, storeId: true, stock: true },
      });
      await recordOpeningStock(tx, rows, userId);
    }
    await tx.store.update({ where: { id: store.id }, data: { catalogRules: input } });
  }, { timeout: 120_000 });

  return {
    created: toCreate.length,
    removed: removeIds.length,
    kept: existing.length - removeIds.length,
    needsPrice: proposed.filter((v) => v.mrp === null && !have.has(v.variantId)).length,
  };
}
