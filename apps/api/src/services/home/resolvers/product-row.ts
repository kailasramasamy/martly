import { parseHomeSectionConfig } from "@martly/shared/schemas";
import { rankedCollectionProductIds } from "../../collection-products.js";
import { withAllSizes } from "../../store-feed.js";
import { sectionBase, withCollectionText, type SectionResolver } from "../types.js";
import { liveCollection } from "./collection.js";

export const productRow: SectionResolver = async (ctx, entry) => {
  const collection = await liveCollection(ctx, entry.collectionId);
  if (!collection) return null;
  const config = parseHomeSectionConfig("PRODUCT_ROW", entry.config) as {
    headerStyle: "PLAIN" | "BANNER" | "ARTWORK"; headerImageUrl?: string; tint?: string; maxProducts: number;
  };
  const ranked = await rankedCollectionProductIds(ctx.prisma, collection.id, ctx.store.id, 1, config.maxProducts);
  if (ranked.length === 0) return null;
  const products = await withAllSizes(ctx.prisma, ctx.store.id, ranked.map((r) => ({ productId: r.id })));
  const base = sectionBase(entry);
  return {
    ...base,
    ...withCollectionText(base, collection),
    type: "PRODUCT_ROW",
    header: { style: config.headerStyle, imageUrl: config.headerImageUrl ?? null, tint: config.tint ?? null },
    products,
    total: ranked[0].total,
    seeAll: { collectionId: collection.id },
  };
};
