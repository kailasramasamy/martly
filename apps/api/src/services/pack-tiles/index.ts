import type { PrismaClient } from "../../../generated/prisma/client.js";
import { storeRegion } from "../brand-popularity.js";
import { composeTile, tileKey } from "./compose.js";
import { pickDepartmentPairs, pickPairs, type Pack } from "./pick.js";

// Tiles being drawn right now, so a second request doesn't draw them again
const drawing = new Set<string>();

async function drawTiles(prisma: PrismaClient, pairs: [Pack, Pack][], square: boolean) {
  for (const pair of pairs) {
    const key = tileKey(pair, square);
    const url = await composeTile(pair, square);
    await prisma.packTile.upsert({ where: { key }, create: { key, url }, update: { url } });
    drawing.delete(key);
  }
}

/** Id → its drawn tile URL. A tile not drawn yet is drawn in the background and its owner keeps its usual art until then. */
async function tileUrls(prisma: PrismaClient, pairs: Map<string, [Pack, Pack]>, square: boolean) {
  const keys = new Map([...pairs].map(([id, pair]) => [id, tileKey(pair, square)]));
  const drawn = await prisma.packTile.findMany({ where: { key: { in: [...keys.values()] } } });
  const urls = new Map(drawn.map((t) => [t.key, t.url]));
  const missing = [...pairs.values()].filter((pair) => !urls.has(tileKey(pair, square)) && !drawing.has(tileKey(pair, square)));
  if (missing.length > 0) {
    missing.forEach((pair) => drawing.add(tileKey(pair, square)));
    void drawTiles(prisma, missing, square).catch((err: unknown) => {
      missing.forEach((pair) => drawing.delete(tileKey(pair, square)));
      console.error("Pack tiles failed to draw", err);
    });
  }
  return new Map([...keys].flatMap(([id, key]) => (urls.has(key) ? [[id, urls.get(key)!] as const] : [])));
}

/** Category id → its pack tile at this store, two of the store's own packs drawn together */
export async function packTileImages(prisma: PrismaClient, storeId: string, categoryIds: string[]) {
  return tileUrls(prisma, await pickPairs(prisma, storeId, await storeRegion(prisma, storeId), categoryIds), false);
}

/** Department id → its square pack tile at this store, for Home's department grid */
export async function departmentTileImages(prisma: PrismaClient, storeId: string, departments: { id: string; categoryIds: string[] }[]) {
  return tileUrls(prisma, await pickDepartmentPairs(prisma, storeId, await storeRegion(prisma, storeId), departments), true);
}
