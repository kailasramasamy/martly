import type { PrismaClient } from "../../../generated/prisma/client.js";
import { storeRegion } from "../brand-popularity.js";
import { composeTile, tileKey } from "./compose.js";
import { pickPairs, type Pack } from "./pick.js";

// Tiles being drawn right now, so a second request doesn't draw them again
const drawing = new Set<string>();

async function drawTiles(prisma: PrismaClient, pairs: [Pack, Pack][]) {
  for (const pair of pairs) {
    const key = tileKey(pair);
    const url = await composeTile(pair);
    await prisma.packTile.upsert({ where: { key }, create: { key, url }, update: { url } });
    drawing.delete(key);
  }
}

/**
 * Category id → its pack tile at this store, two of the store's own packs drawn together. A tile not drawn yet is
 * drawn in the background and the category keeps its usual art until then.
 */
export async function packTileImages(prisma: PrismaClient, storeId: string, categoryIds: string[]) {
  const pairs = await pickPairs(prisma, storeId, await storeRegion(prisma, storeId), categoryIds);
  const keys = new Map([...pairs].map(([categoryId, pair]) => [categoryId, tileKey(pair)]));
  const drawn = await prisma.packTile.findMany({ where: { key: { in: [...keys.values()] } } });
  const urls = new Map(drawn.map((t) => [t.key, t.url]));
  const missing = [...pairs.values()].filter((pair) => !urls.has(tileKey(pair)) && !drawing.has(tileKey(pair)));
  if (missing.length > 0) {
    missing.forEach((pair) => drawing.add(tileKey(pair)));
    void drawTiles(prisma, missing).catch((err: unknown) => {
      missing.forEach((pair) => drawing.delete(tileKey(pair)));
      console.error("Pack tiles failed to draw", err);
    });
  }
  return new Map([...keys].flatMap(([categoryId, key]) => (urls.has(key) ? [[categoryId, urls.get(key)!] as const] : [])));
}
