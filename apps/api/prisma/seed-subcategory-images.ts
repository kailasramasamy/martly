/**
 * Fill missing subcategory images with the photo of the subcategory's most widely stocked product.
 * Only touches subcategories without an image, so admin-set images are never overwritten.
 * Run: cd apps/api && npx tsx prisma/seed-subcategory-images.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const subcategories = await prisma.subcategory.findMany({
    where: { imageUrl: null },
    select: { id: true, name: true },
  });

  let filled = 0;
  for (const sub of subcategories) {
    const product = await prisma.product.findFirst({
      where: { subcategoryId: sub.id, imageUrl: { not: null } },
      orderBy: { storeProducts: { _count: "desc" } },
      select: { imageUrl: true },
    });
    if (!product?.imageUrl) continue;
    await prisma.subcategory.update({ where: { id: sub.id }, data: { imageUrl: product.imageUrl } });
    filled++;
  }

  console.log(`✔ ${filled}/${subcategories.length} subcategories now have an image`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
