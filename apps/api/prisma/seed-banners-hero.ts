/**
 * Seed HERO_CAROUSEL banners — one for each action type
 * Run: cd apps/api && npx tsx prisma/seed-banners-hero.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding HERO_CAROUSEL banners...\n");

  const org = await prisma.organization.findFirst();
  if (!org) { console.error("No org found."); return; }

  const store = await prisma.store.findFirst({ select: { id: true, name: true } });
  if (!store) { console.error("No store found."); return; }

  console.log(`Org: ${org.name} | Store: ${store.name}\n`);

  // Get targets for each action type
  const [dairyDept, fruitsDept, snacksDept, frozenDept, beveragesDept] = await Promise.all([
    prisma.department.findFirst({ where: { name: { contains: "Dairy", mode: "insensitive" } }, select: { id: true, name: true } }),
    prisma.department.findFirst({ where: { name: { contains: "Fruits", mode: "insensitive" } }, select: { id: true, name: true } }),
    prisma.department.findFirst({ where: { name: { contains: "Snacks", mode: "insensitive" } }, select: { id: true, name: true } }),
    prisma.department.findFirst({ where: { name: { contains: "Frozen", mode: "insensitive" } }, select: { id: true, name: true } }),
    prisma.department.findFirst({ where: { name: { contains: "Beverages", mode: "insensitive" } }, select: { id: true, name: true } }),
  ]);

  const collection = await prisma.collection.findFirst({ where: { slug: "best-sellers" }, select: { id: true, slug: true } });

  const featuredProduct = await prisma.storeProduct.findFirst({
    where: { storeId: store.id, isActive: true, isFeatured: true, stock: { gt: 0 } },
    include: { product: { select: { id: true, name: true } } },
  });

  // Clean existing HERO_CAROUSEL banners
  await prisma.banner.deleteMany({ where: { placement: "HERO_CAROUSEL" } });

  // Unsplash images sized 750x360 for hero banners
  const banners = [
    // 1. CATEGORY — Fresh Fruits & Vegetables
    {
      title: "Farm Fresh Produce",
      subtitle: "Fruits & vegetables delivered within hours",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=750&h=360&fit=crop&crop=center",
      placement: "HERO_CAROUSEL" as const,
      actionType: "CATEGORY" as const,
      actionTarget: fruitsDept?.id ?? null,
      departmentId: fruitsDept?.id ?? null,
      sortOrder: 0,
    },
    // 2. PRODUCT — Featured product spotlight
    {
      title: "Top Pick of the Week",
      subtitle: featuredProduct ? `Try ${featuredProduct.product.name}` : "Check out our top picks",
      imageUrl: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=750&h=360&fit=crop&crop=center",
      placement: "HERO_CAROUSEL" as const,
      actionType: "PRODUCT" as const,
      actionTarget: featuredProduct?.productId ?? null,
      sortOrder: 1,
    },
    // 3. COLLECTION — Best Sellers
    {
      title: "Best Sellers",
      subtitle: "Most loved products this week",
      imageUrl: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=750&h=360&fit=crop&crop=center",
      placement: "HERO_CAROUSEL" as const,
      actionType: "COLLECTION" as const,
      actionTarget: collection?.slug ?? null,
      sortOrder: 2,
    },
    // 4. SEARCH — Dairy deals
    {
      title: "Dairy Deals",
      subtitle: "Fresh milk, curd & paneer at great prices",
      imageUrl: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=750&h=360&fit=crop&crop=center",
      placement: "HERO_CAROUSEL" as const,
      actionType: "SEARCH" as const,
      actionTarget: "milk curd paneer",
      sortOrder: 3,
    },
    // 5. URL — Membership promo
    {
      title: "Join Mart Plus",
      subtitle: "Free delivery + extra loyalty on every order",
      imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=750&h=360&fit=crop&crop=center",
      placement: "HERO_CAROUSEL" as const,
      actionType: "URL" as const,
      actionTarget: "martly://membership",
      sortOrder: 4,
    },
    // 6. NONE — Seasonal/branding banner
    {
      title: "Summer Sale is Here",
      subtitle: "Cool drinks, ice cream & frozen treats",
      imageUrl: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=750&h=360&fit=crop&crop=center",
      placement: "HERO_CAROUSEL" as const,
      actionType: "NONE" as const,
      actionTarget: null,
      sortOrder: 5,
    },
  ];

  for (const banner of banners) {
    const created = await prisma.banner.create({
      data: {
        title: banner.title,
        subtitle: banner.subtitle,
        imageUrl: banner.imageUrl,
        placement: banner.placement,
        actionType: banner.actionType,
        actionTarget: banner.actionTarget,
        sortOrder: banner.sortOrder,
        isActive: true,
        organizationId: org.id,
        departmentId: banner.departmentId ?? undefined,
      },
    });
    console.log(`  [${banner.actionType}] ${banner.title} → ${banner.actionTarget ?? "(no target)"}`);
  }

  // Verify
  const count = await prisma.banner.count({ where: { placement: "HERO_CAROUSEL", isActive: true } });
  console.log(`\n--- Verification ---`);
  console.log(`  HERO_CAROUSEL banners: ${count}`);
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
