import { parseHomeSectionConfig } from "@martly/shared/schemas";
import type { HomeTheme } from "@martly/shared/types";
import { withAllSizes } from "../../store-feed.js";
import { sectionBase, withCollectionText, type SectionResolver } from "../types.js";
import { autoTiles, itemTiles, stockedCollectionItems } from "./campaign-tiles.js";
import { liveCollection } from "./collection.js";
import { defaultTheme } from "../campaign-look.js";

const HIGHLIGHTS = 5;

export const campaignCard: SectionResolver = async (ctx, entry) => {
  const collection = await liveCollection(ctx, entry.collectionId);
  if (!collection) return null;
  const config = parseHomeSectionConfig("CAMPAIGN_CARD", entry.config) as {
    offerLabel?: string; imageUrl?: string; theme?: HomeTheme; tileSource: "AUTO" | "ITEMS";
  };
  const stocked = await stockedCollectionItems(ctx.prisma, collection.id, ctx.store.id);
  if (stocked.length === 0) return null;
  const [tiles, highlights] = await Promise.all([
    config.tileSource === "ITEMS" ? Promise.resolve(itemTiles(entry.items, stocked)) : autoTiles(ctx.prisma, stocked),
    withAllSizes(ctx.prisma, ctx.store.id, stocked.slice(0, HIGHLIGHTS)),
  ]);
  const base = sectionBase(entry);
  return {
    ...base,
    ...withCollectionText(base, collection),
    type: "CAMPAIGN_CARD",
    collectionId: collection.id,
    offerLabel: config.offerLabel ?? null,
    imageUrl: config.imageUrl ?? collection.imageUrl,
    theme: config.theme ?? defaultTheme(collection.id),
    tiles,
    highlights,
    productCount: stocked.length,
    endsAt: collection.endsAt?.toISOString() ?? null,
    seeAll: { collectionId: collection.id },
  };
};
