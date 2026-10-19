import { parseHomeSectionConfig } from "@martly/shared/schemas";
import { bandPage } from "../price-band.js";
import { sectionBase, type SectionResolver } from "../types.js";
import { liveCollection } from "./collection.js";

type BandConfig = { headline?: string; bands: { label: string; maxPrice: number | null }[] };

export const priceBandDeals: SectionResolver = async (ctx, entry) => {
  const collection = entry.collectionId ? await liveCollection(ctx, entry.collectionId) : null;
  if (entry.collectionId && !collection) return null;
  const config = parseHomeSectionConfig("PRICE_BAND_DEALS", entry.config) as BandConfig;
  const first = await bandPage(ctx.prisma, {
    storeId: ctx.store.id, collectionId: collection?.id ?? null, maxPrice: config.bands[0].maxPrice, now: ctx.now,
  }, 1);
  if (first.total === 0) return null;
  return {
    ...sectionBase(entry),
    type: "PRICE_BAND_DEALS",
    headline: config.headline ?? null,
    bands: config.bands.map((b, i) => ({ id: String(i), label: b.label, maxPrice: b.maxPrice })),
    ...first,
  };
};
