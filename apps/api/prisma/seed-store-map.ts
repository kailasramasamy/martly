import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  // Find Bigmart store
  const store = await prisma.store.findFirst({
    where: { name: { contains: "Bigmart", mode: "insensitive" } },
    select: { id: true, name: true, organizationId: true },
  });

  if (!store) {
    // List all stores for debugging
    const stores = await prisma.store.findMany({
      select: { id: true, name: true, organizationId: true },
    });
    console.log("Available stores:", stores);
    throw new Error("Bigmart store not found");
  }

  console.log(`Mapping products to: ${store.name} (${store.id})`);

  // Get all products with their variants
  const products = await prisma.product.findMany({
    include: { variants: true },
  });

  console.log(`Found ${products.length} products with variants`);

  // Get existing store product mappings to avoid duplicates
  const existing = await prisma.storeProduct.findMany({
    where: { storeId: store.id },
    select: { variantId: true },
  });
  const existingVariantIds = new Set(existing.map((sp) => sp.variantId));
  console.log(`${existingVariantIds.size} variants already mapped`);

  let created = 0;
  let skipped = 0;

  for (const product of products) {
    for (const variant of product.variants) {
      if (existingVariantIds.has(variant.id)) {
        skipped++;
        continue;
      }

      // Calculate store price: 90-100% of MRP (random small discount)
      const mrp = Number(variant.mrp || 0);
      if (mrp === 0) {
        skipped++;
        continue;
      }

      // Random discount between 0-10% off MRP
      const discountPct = Math.random() * 0.10;
      const price = Math.round((mrp * (1 - discountPct)) * 100) / 100;

      // Random stock between 10 and 200
      const stock = Math.floor(Math.random() * 191) + 10;

      // ~15% chance of being featured
      const isFeatured = Math.random() < 0.15;

      // ~10% chance of having an active discount
      const hasDiscount = Math.random() < 0.10;

      await prisma.storeProduct.create({
        data: {
          storeId: store.id,
          productId: product.id,
          variantId: variant.id,
          price,
          stock,
          isActive: true,
          isFeatured,
          ...(hasDiscount
            ? {
                discountType: Math.random() < 0.5 ? "PERCENTAGE" : "FLAT",
                discountValue:
                  Math.random() < 0.5
                    ? Math.floor(Math.random() * 15) + 5 // 5-20% off
                    : Math.floor(mrp * 0.05) + 1, // small flat discount
                discountStart: new Date(),
                discountEnd: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
                ),
              }
            : {}),
        },
      });
      created++;
    }
  }

  console.log(
    `\nDone: ${created} store-product mappings created, ${skipped} skipped`
  );

  // Summary stats
  const totalMapped = await prisma.storeProduct.count({
    where: { storeId: store.id },
  });
  const featuredCount = await prisma.storeProduct.count({
    where: { storeId: store.id, isFeatured: true },
  });
  const discountCount = await prisma.storeProduct.count({
    where: {
      storeId: store.id,
      discountType: { not: null },
      discountEnd: { gte: new Date() },
    },
  });

  console.log(`\nBigmart store summary:`);
  console.log(`  Total mapped variants: ${totalMapped}`);
  console.log(`  Featured: ${featuredCount}`);
  console.log(`  With active discount: ${discountCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
