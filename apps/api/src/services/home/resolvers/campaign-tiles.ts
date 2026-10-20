import type { CampaignTile } from "@martly/shared/types";
import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { LayoutItem } from "../types.js";

const TILE_IMAGES = 3;
const ROW = 3;
const MAX_TILES = 6;

export interface StockedItem { productId: string; imageUrl: string | null; subcategoryId: string | null; categoryId: string | null }

type Group = { key: string; subcategoryIds: Set<string>; images: string[]; count: number };

function groupBy(items: StockedItem[], pick: (i: StockedItem) => string | null) {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = pick(item);
    if (!key || !item.subcategoryId) continue;
    const group = groups.get(key) ?? { key, subcategoryIds: new Set<string>(), images: [], count: 0 };
    group.subcategoryIds.add(item.subcategoryId);
    if (item.imageUrl && group.images.length < TILE_IMAGES) group.images.push(item.imageUrl);
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// Whole rows of three; fewer than three aisles show as they are, and a lone aisle is no menu at all
function wholeRows<T>(groups: T[]) {
  if (groups.length < ROW) return groups.length >= 2 ? groups : [];
  return groups.slice(0, Math.min(MAX_TILES, groups.length - (groups.length % ROW)));
}

async function labels(prisma: PrismaClient, keys: string[], byCategory: boolean) {
  const select = { id: true, name: true, translations: true };
  const rows = byCategory
    ? await prisma.category.findMany({ where: { id: { in: keys } }, select })
    : await prisma.subcategory.findMany({ where: { id: { in: keys } }, select });
  return new Map(rows.map((r) => [r.id, { name: r.name, translations: asLabelTranslations(r.translations) }]));
}

// Taxonomy translations carry a `name`; tiles show a `label`
function asLabelTranslations(translations: unknown): CampaignTile["translations"] {
  if (!translations || typeof translations !== "object") return null;
  return Object.fromEntries(
    Object.entries(translations as Record<string, { name?: string }>).map(([lang, t]) => [lang, { label: t?.name }]),
  );
}

/** A collection's products in stock at a store, with what aisle grouping needs, in collection order */
export async function stockedCollectionItems(prisma: PrismaClient, collectionId: string, storeId: string): Promise<StockedItem[]> {
  const rows = await prisma.collectionItem.findMany({
    where: {
      collectionId,
      product: { isActive: true, storeProducts: { some: { storeId, isActive: true, stock: { gt: 0 } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { productId: "asc" }],
    select: { productId: true, product: { select: { imageUrl: true, subcategoryId: true, subcategory: { select: { categoryId: true } } } } },
  });
  return rows.map((r) => ({
    productId: r.productId, imageUrl: r.product.imageUrl, subcategoryId: r.product.subcategoryId, categoryId: r.product.subcategory?.categoryId ?? null,
  }));
}

/**
 * Aisle tiles built from what the collection holds in stock: by category, or by subcategory when that gives too few.
 * A card shows whole rows of tiles; `every` keeps all aisles, for the collection screen's chips.
 */
export async function autoTiles(prisma: PrismaClient, items: StockedItem[], every = false): Promise<CampaignTile[]> {
  let byCategory = true;
  let groups = groupBy(items, (i) => i.categoryId);
  if (groups.length < ROW) {
    byCategory = false;
    groups = groupBy(items, (i) => i.subcategoryId);
  }
  const shown = every ? (groups.length >= 2 ? groups : []) : wholeRows(groups);
  const names = await labels(prisma, shown.map((g) => g.key), byCategory);
  return shown.map((g) => ({
    id: g.key, label: names.get(g.key)?.name ?? "", translations: names.get(g.key)?.translations ?? null,
    subcategoryIds: [...g.subcategoryIds], images: g.images, productCount: g.count,
  }));
}

/** Tiles the admin defined; each shows the collection's stocked products from its aisles and hides when there are none. */
export function itemTiles(layoutItems: LayoutItem[], items: StockedItem[]): CampaignTile[] {
  return layoutItems.flatMap((li) => {
    const wanted = new Set(li.subcategoryIds);
    const matching = items.filter((i) => i.subcategoryId && wanted.has(i.subcategoryId));
    if (matching.length === 0) return [];
    const images = matching.flatMap((i) => (i.imageUrl ? [i.imageUrl] : [])).slice(0, TILE_IMAGES);
    return [{ id: li.id, label: li.label, translations: li.translations as CampaignTile["translations"], subcategoryIds: li.subcategoryIds, images: images.length > 0 ? images : li.imageUrl ? [li.imageUrl] : [], productCount: matching.length }];
  });
}
