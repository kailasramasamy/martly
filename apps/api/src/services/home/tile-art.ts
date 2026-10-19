import { randomUUID } from "crypto";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { putObject } from "../media.js";
import { paintTile } from "../seasonal/hero-art.js";

// Names that tell the painter what the tile's collection holds
const SAMPLE_PRODUCTS = 6;
// Image calls in flight at once
const CONCURRENCY = 3;

type ArtItem = { id: string; label: string; collectionId: string | null; subcategoryIds: string[] };

// "Party snacks: chips, namkeen, cola, …" from the collection's lead products, narrowed to the tile's aisles
async function tileSubject(prisma: PrismaClient, item: ArtItem) {
  const products = item.collectionId
    ? await prisma.collectionItem.findMany({
        where: {
          collectionId: item.collectionId,
          product: { isActive: true, ...(item.subcategoryIds.length > 0 ? { subcategoryId: { in: item.subcategoryIds } } : {}) },
        },
        orderBy: { sortOrder: "asc" },
        take: SAMPLE_PRODUCTS,
        select: { product: { select: { subcategory: { select: { name: true } } } } },
      })
    : [];
  const aisles = [...new Set(products.map((p) => p.product.subcategory?.name).filter(Boolean))];
  return aisles.length > 0 ? `${item.label.toLowerCase()} essentials such as ${aisles.join(", ").toLowerCase()}` : item.label.toLowerCase();
}

async function paintItem(prisma: PrismaClient, item: ArtItem) {
  const art = await paintTile(await tileSubject(prisma, item));
  const { url } = await putObject(`home/tiles/${item.id}-${randomUUID()}.webp`, art, "image/webp");
  await prisma.homeSectionItem.update({ where: { id: item.id }, data: { imageUrl: url } });
  return url;
}

/** Paints a transparent cut-out for each of these tiles and saves it as the tile's image, a few at a time. */
export async function paintTiles(prisma: PrismaClient, items: ArtItem[]) {
  const painted: { id: string; imageUrl: string }[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const urls = await Promise.all(batch.map((item) => paintItem(prisma, item)));
    batch.forEach((item, j) => painted.push({ id: item.id, imageUrl: urls[j] }));
  }
  return painted;
}
