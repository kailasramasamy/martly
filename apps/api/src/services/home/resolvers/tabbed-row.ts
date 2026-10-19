import { HOME_ROW_MAX_PRODUCTS } from "@martly/shared/constants";
import { parseHomeSectionConfig } from "@martly/shared/schemas";
import type { HomeTab } from "@martly/shared/types";
import { rankedCollectionProductIds } from "../../collection-products.js";
import { liveWindow, withAllSizes } from "../../store-feed.js";
import { sectionBase, type ResolveContext, type SectionResolver } from "../types.js";
import type { TabRailStyle } from "@martly/shared/constants";

// Which of these collections are live for the organisation and have something in stock at the store
async function stockedCollections(ctx: ResolveContext, ids: string[]) {
  const live = await ctx.prisma.collection.findMany({
    where: {
      id: { in: ids }, isActive: true, AND: liveWindow(ctx.now),
      OR: [{ organizationId: ctx.store.organizationId }, { organizationId: null }],
    },
    select: { id: true, imageUrl: true },
  });
  if (live.length === 0) return new Map<string, string | null>();
  // Each stocked collection's lead product image stands in for a tab icon the collection has none for
  const stocked = await ctx.prisma.$queryRaw<{ collection_id: string; image_url: string | null }[]>`
    SELECT DISTINCT ON (ci.collection_id) ci.collection_id, p.image_url FROM collection_items ci
    JOIN products p ON p.id = ci.product_id AND p.is_active
    WHERE ci.collection_id = ANY(${live.map((c) => c.id)}::text[])
      AND EXISTS (SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${ctx.store.id} AND sp.is_active AND sp.stock > 0)
    ORDER BY ci.collection_id, p.image_url IS NULL, ci.sort_order`;
  const leadImage = new Map(stocked.map((r) => [r.collection_id, r.image_url]));
  return new Map(live.filter((c) => leadImage.has(c.id)).map((c) => [c.id, c.imageUrl ?? leadImage.get(c.id) ?? null]));
}

export const tabbedRow: SectionResolver = async (ctx, entry) => {
  const ids = entry.items.map((i) => i.collectionId).filter((id): id is string => !!id);
  const stocked = await stockedCollections(ctx, ids);
  const tabs: HomeTab[] = entry.items.flatMap((item) => (item.collectionId && stocked.has(item.collectionId)
    ? [{
        id: item.id, label: item.label, translations: item.translations as HomeTab["translations"],
        imageUrl: item.imageUrl ?? stocked.get(item.collectionId) ?? null, collectionId: item.collectionId,
      }]
    : []));
  if (tabs.length === 0) return null;
  const { tabStyle, tint } = parseHomeSectionConfig("TABBED_ROW", entry.config) as { tabStyle: TabRailStyle; tint?: string };
  const ranked = await rankedCollectionProductIds(ctx.prisma, tabs[0].collectionId, ctx.store.id, 1, HOME_ROW_MAX_PRODUCTS);
  return {
    ...sectionBase(entry),
    type: "TABBED_ROW",
    tabStyle,
    tint: tint ?? null,
    tabs,
    products: await withAllSizes(ctx.prisma, ctx.store.id, ranked.map((r) => ({ productId: r.id }))),
    total: ranked[0]?.total ?? 0,
    seeAll: { collectionId: tabs[0].collectionId },
  };
};
