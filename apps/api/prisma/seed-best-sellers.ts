/**
 * Curate the "Best Sellers" home collection with everyday staples.
 * Replaces the collection's items, in this order, with products matched by name prefix.
 * Run: cd apps/api && npx tsx prisma/seed-best-sellers.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const COLLECTION_TITLE = "Best Sellers";

const PRODUCT_NAME_PREFIXES = [
  "Fresh Onion (Pyaaz)",
  "Fresh Potato (Aloo)",
  "Fresh Banana - Robusta",
  "Amul Taaza Toned Milk",
  "Fortune Chakki Fresh Atta",
  "India Gate Sona Masoori Rice",
  "Fortune Sunlite Refined Sunflower Oil",
  "Tata Salt - Vacuum Evaporated",
  "Amul Pure Ghee",
  "Mother Dairy Fresh Paneer",
  "Fresh Coriander Leaves (Dhaniya)",
  "Parle-G Gold Biscuits",
];

async function main() {
  const collection = await prisma.collection.findFirst({ where: { title: COLLECTION_TITLE } });
  if (!collection) throw new Error(`Collection "${COLLECTION_TITLE}" not found`);

  const productIds: string[] = [];
  for (const prefix of PRODUCT_NAME_PREFIXES) {
    const product = await prisma.product.findFirst({ where: { name: { startsWith: prefix } }, select: { id: true } });
    if (!product) throw new Error(`No product starting with "${prefix}"`);
    productIds.push(product.id);
  }

  await prisma.$transaction([
    prisma.collectionItem.deleteMany({ where: { collectionId: collection.id } }),
    prisma.collectionItem.createMany({
      data: productIds.map((productId, sortOrder) => ({ collectionId: collection.id, productId, sortOrder })),
    }),
  ]);
  console.log(`✔ ${COLLECTION_TITLE}: ${productIds.length} staples`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
