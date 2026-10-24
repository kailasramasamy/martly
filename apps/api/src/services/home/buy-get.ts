import { BUY_GET_PAGE_SIZE } from "@martly/shared/constants";
import type { PriceBandChip, PriceBandPage } from "@martly/shared/types";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { storeListings } from "../store-feed.js";

const BUY_GET_CHIPS = 12;

/** Store listings with a buy X get Y offer running right now */
export function activeOfferWhere(storeId: string, now: Date): Prisma.StoreProductWhereInput {
  return {
    storeId,
    isActive: true,
    offerBuyQty: { not: null },
    offerGetQty: { not: null },
    AND: [
      { OR: [{ offerStart: null }, { offerStart: { lte: now } }] },
      { OR: [{ offerEnd: null }, { offerEnd: { gte: now } }] },
    ],
  };
}

// The most generous offers first (2+2 before 2+1), then by name so pages stay stable
function rank(a: OfferRow, b: OfferRow) {
  const share = (r: OfferRow) => r.offerGetQty! / (r.offerBuyQty! + r.offerGetQty!);
  return share(b) - share(a) || a.product.name.localeCompare(b.product.name) || a.id.localeCompare(b.id);
}

type OfferRow = Awaited<ReturnType<typeof offerRows>>[number];

function offerRows(prisma: PrismaClient, storeId: string, now: Date) {
  return prisma.storeProduct.findMany({
    where: activeOfferWhere(storeId, now),
    select: {
      id: true, offerBuyQty: true, offerGetQty: true,
      product: { select: { name: true, subcategory: { select: { categoryId: true } } } },
    },
  });
}

/** Categories with offers, the busiest first */
async function offerChips(prisma: PrismaClient, rows: OfferRow[]): Promise<PriceBandChip[]> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const id = r.product.subcategory?.categoryId;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, BUY_GET_CHIPS).map(([id]) => id);
  const categories = await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, translations: true, imageUrl: true } });
  const byId = new Map(categories.map((c) => [c.id, c]));
  return ids.flatMap((id) => {
    const c = byId.get(id);
    return c ? [{ categoryId: c.id, label: c.name, translations: c.translations as PriceBandChip["translations"], imageUrl: c.imageUrl }] : [];
  });
}

/** The Home row: the best offers and how many there are in all */
export async function buyGetRow(prisma: PrismaClient, storeId: string, now: Date, limit: number) {
  const rows = (await offerRows(prisma, storeId, now)).sort(rank);
  return { products: await storeListings(prisma, rows.slice(0, limit).map((r) => r.id)), total: rows.length };
}

/** One page of the full list, narrowed by a category chip; the chips always count every offer */
export async function buyGetPage(
  prisma: PrismaClient,
  f: { storeId: string; categoryId?: string; page: number; now: Date },
): Promise<PriceBandPage> {
  const rows = (await offerRows(prisma, f.storeId, f.now)).sort(rank);
  const picked = f.categoryId ? rows.filter((r) => r.product.subcategory?.categoryId === f.categoryId) : rows;
  const start = (f.page - 1) * BUY_GET_PAGE_SIZE;
  const [chips, products] = await Promise.all([
    offerChips(prisma, rows),
    storeListings(prisma, picked.slice(start, start + BUY_GET_PAGE_SIZE).map((r) => r.id)),
  ]);
  return { chips, products, total: picked.length };
}
