/**
 * Seed home feed content: collections, deals (discounts), featured products
 * Run AFTER seed-new-catalog.ts
 *
 * Usage: cd apps/api && npx tsx prisma/seed-home-feed.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding home feed content...\n");

  // Find the store
  const store = await prisma.store.findFirst({ select: { id: true, name: true, organizationId: true } });
  if (!store) {
    console.log("No store found. Run base seed first.");
    return;
  }
  console.log(`Store: ${store.name} (${store.id})\n`);

  // ── 1. Create Collections ─────────────────────────────

  console.log("Creating collections...");

  // Clean existing collections
  await prisma.collectionItem.deleteMany();
  await prisma.collection.deleteMany();

  // Get some products by subcategory name for curated collections
  async function getProductsBySubcategory(subcategoryNames: string[], limit: number) {
    return prisma.storeProduct.findMany({
      where: {
        storeId: store!.id,
        isActive: true,
        stock: { gt: 0 },
        product: {
          isActive: true,
          subcategory: { name: { in: subcategoryNames, mode: "insensitive" } },
        },
      },
      take: limit,
      orderBy: { stock: "desc" },
      select: { productId: true },
    });
  }

  // Get featured products
  const featuredSps = await prisma.storeProduct.findMany({
    where: { storeId: store.id, isActive: true, isFeatured: true, stock: { gt: 0 } },
    take: 12,
    orderBy: { stock: "desc" },
    select: { productId: true },
  });
  const featuredProductIds = [...new Set(featuredSps.map(sp => sp.productId))].slice(0, 10);

  if (featuredProductIds.length > 0) {
    const col = await prisma.collection.create({
      data: {
        title: "Best Sellers",
        subtitle: "Most popular items this week",
        slug: "best-sellers",
        isActive: true,
        sortOrder: 0,
        organizationId: store.organizationId,
      },
    });
    await prisma.collectionItem.createMany({
      data: featuredProductIds.map((pid, i) => ({
        collectionId: col.id,
        productId: pid,
        sortOrder: i,
      })),
    });
    console.log(`  Best Sellers: ${featuredProductIds.length} products`);
  }

  // Morning Essentials collection
  const morningProducts = await getProductsBySubcategory(
    ["Full Cream Milk", "Toned Milk", "Fresh Curd (Dahi)", "Brown Eggs", "White Eggs", "Sandwich Bread", "Brown & Whole Wheat Bread", "Instant Coffee", "Tea Bags"],
    12,
  );
  const morningProductIds = [...new Set(morningProducts.map(sp => sp.productId))].slice(0, 10);

  if (morningProductIds.length > 0) {
    const col = await prisma.collection.create({
      data: {
        title: "Morning Essentials",
        subtitle: "Start your day right",
        slug: "morning-essentials",
        isActive: true,
        sortOrder: 1,
        organizationId: store.organizationId,
      },
    });
    await prisma.collectionItem.createMany({
      data: morningProductIds.map((pid, i) => ({
        collectionId: col.id,
        productId: pid,
        sortOrder: i,
      })),
    });
    console.log(`  Morning Essentials: ${morningProductIds.length} products`);
  }

  // Snack Time collection
  const snackProducts = await getProductsBySubcategory(
    ["Potato Chips", "Cream Biscuits", "Kurkure & Extruded Snacks", "Bhujia & Sev", "Chocolate Bars & Countlines", "Mixture & Chivda"],
    12,
  );
  const snackProductIds = [...new Set(snackProducts.map(sp => sp.productId))].slice(0, 10);

  if (snackProductIds.length > 0) {
    const col = await prisma.collection.create({
      data: {
        title: "Snack Time",
        subtitle: "Crunch, munch & enjoy",
        slug: "snack-time",
        isActive: true,
        sortOrder: 2,
        organizationId: store.organizationId,
      },
    });
    await prisma.collectionItem.createMany({
      data: snackProductIds.map((pid, i) => ({
        collectionId: col.id,
        productId: pid,
        sortOrder: i,
      })),
    });
    console.log(`  Snack Time: ${snackProductIds.length} products`);
  }

  // ── 2. Create Deals (store product discounts) ──────────

  console.log("\nCreating deals (discounts)...");

  // Pick random store products for discounts
  const dealCandidates = await prisma.storeProduct.findMany({
    where: {
      storeId: store.id,
      isActive: true,
      stock: { gt: 5 },
      price: { gt: 50 },
    },
    take: 200,
    orderBy: { price: "desc" },
    select: { id: true, price: true },
  });

  // Apply discounts to ~30 products
  const dealCount = Math.min(30, dealCandidates.length);
  const shuffled = dealCandidates.sort(() => Math.random() - 0.5).slice(0, dealCount);

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let dealsCreated = 0;
  for (const sp of shuffled) {
    const isPercentage = Math.random() > 0.5;
    const discountValue = isPercentage
      ? [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)]
      : Math.round(Number(sp.price) * (0.05 + Math.random() * 0.15));

    await prisma.storeProduct.update({
      where: { id: sp.id },
      data: {
        discountType: isPercentage ? "PERCENTAGE" : "FLAT",
        discountValue,
        discountStart: now,
        discountEnd: weekLater,
      },
    });
    dealsCreated++;
  }
  console.log(`  ${dealsCreated} store products with active discounts`);

  // ── 3. Mark more products as featured ──────────────────

  console.log("\nMarking featured products...");

  // Ensure at least 20 featured products spread across departments
  const departments = await prisma.department.findMany({ select: { id: true, name: true } });

  let totalFeatured = 0;
  for (const dept of departments) {
    const sps = await prisma.storeProduct.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        stock: { gt: 0 },
        product: {
          isActive: true,
          subcategory: { category: { departmentId: dept.id } },
        },
      },
      take: 3,
      orderBy: { stock: "desc" },
      select: { id: true },
    });

    if (sps.length > 0) {
      await prisma.storeProduct.updateMany({
        where: { id: { in: sps.map(s => s.id) } },
        data: { isFeatured: true },
      });
      totalFeatured += sps.length;
    }
  }
  console.log(`  ${totalFeatured} products marked as featured`);

  // ── Summary ────────────────────────────────────────────

  console.log("\n--- Verification ---");
  const colCount = await prisma.collection.count();
  const colItemCount = await prisma.collectionItem.count();
  const dealsSp = await prisma.storeProduct.count({
    where: { storeId: store.id, discountType: { not: null }, discountValue: { gt: 0 } },
  });
  const featuredCount = await prisma.storeProduct.count({
    where: { storeId: store.id, isFeatured: true },
  });

  console.log(`  Collections: ${colCount} (${colItemCount} items)`);
  console.log(`  Deals: ${dealsSp} store products with discounts`);
  console.log(`  Featured: ${featuredCount} store products`);
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
