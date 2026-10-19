import { TILE_PACK_IMAGES } from "@martly/shared/constants";
import type { GridTile } from "@martly/shared/types";
import { liveWindow } from "../../store-feed.js";
import { sectionBase, type ResolveContext, type SectionResolver } from "../types.js";

// Fewer tiles than this is no grid at all
const MIN_TILES = 2;

type Stocked = { imageUrl: string | null; packImages: string[] };

// Each live, reachable collection the store has something in stock for, with its first few product images
async function stockedCollections(ctx: ResolveContext, ids: string[]) {
  const live = await ctx.prisma.collection.findMany({
    where: {
      id: { in: ids }, isActive: true, AND: liveWindow(ctx.now),
      OR: [{ organizationId: ctx.store.organizationId }, { organizationId: null }],
    },
    select: { id: true, imageUrl: true },
  });
  if (live.length === 0) return new Map<string, Stocked>();
  const rows = await ctx.prisma.$queryRaw<{ collection_id: string; images: (string | null)[] }[]>`
    SELECT collection_id, (array_agg(image_url ORDER BY image_url IS NULL, sort_order))[1:${TILE_PACK_IMAGES}] AS images
    FROM (
      SELECT ci.collection_id, ci.sort_order, p.image_url FROM collection_items ci
      JOIN products p ON p.id = ci.product_id AND p.is_active
      WHERE ci.collection_id = ANY(${live.map((c) => c.id)}::text[])
        AND EXISTS (SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${ctx.store.id} AND sp.is_active AND sp.stock > 0)
    ) stocked
    GROUP BY collection_id`;
  const images = new Map(rows.map((r) => [r.collection_id, r.images.filter((i): i is string => !!i)]));
  return new Map(live.filter((c) => images.has(c.id)).map((c) => [c.id, { imageUrl: c.imageUrl, packImages: images.get(c.id)! }]));
}

/** Explore and Shop by store grids: each item opens its collection; items whose collection is gone or empty here drop out */
export const tileGrid: SectionResolver = async (ctx, entry) => {
  const stocked = await stockedCollections(ctx, entry.items.flatMap((i) => (i.collectionId ? [i.collectionId] : [])));
  const tiles: GridTile[] = entry.items.flatMap((item) => {
    const collection = item.collectionId ? stocked.get(item.collectionId) : undefined;
    if (!item.collectionId || !collection) return [];
    return [{
      id: item.id, label: item.label, translations: item.translations as GridTile["translations"],
      imageUrl: item.imageUrl ?? collection.imageUrl, packImages: collection.packImages,
      wide: item.wide, collectionId: item.collectionId, subcategoryIds: item.subcategoryIds,
    }];
  });
  if (tiles.length < MIN_TILES) return null;
  return { ...sectionBase(entry), type: entry.type as "EXPLORE_GRID" | "STORE_GRID", tiles };
};
