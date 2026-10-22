import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No organization found — run base seed first");

  const categories = await prisma.category.findMany({
    where: { parentId: null },
    take: 10,
    orderBy: { sortOrder: "asc" },
  });

  // Clean existing banners
  await prisma.banner.deleteMany({ where: { organizationId: org.id } });
  console.log("Cleared existing banners");

  const banners = await prisma.banner.createMany({
    data: [
      // ── Hero Carousel (3) ──
      {
        title: "Fresh Produce Sale",
        subtitle: "Up to 30% off on fruits & vegetables",
        imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=400&fit=crop",
        placement: "HERO_CAROUSEL",
        actionType: "SEARCH",
        actionTarget: "fresh produce",
        sortOrder: 0,
        organizationId: org.id,
      },
      {
        title: "Summer Beverages",
        subtitle: "Cool drinks for hot days",
        imageUrl: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=400&fit=crop",
        placement: "HERO_CAROUSEL",
        actionType: "SEARCH",
        actionTarget: "beverages",
        sortOrder: 1,
        organizationId: org.id,
      },
      {
        title: "Free Delivery Weekend",
        subtitle: "No minimum order required",
        imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop",
        placement: "HERO_CAROUSEL",
        actionType: "NONE",
        sortOrder: 2,
        organizationId: org.id,
      },

      // ── Category Top — category-specific banners ──
      ...(categories.length > 0
        ? [
            {
              title: "Breakfast Essentials",
              subtitle: "Start your day right",
              imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&h=300&fit=crop",
              placement: "CATEGORY_TOP" as const,
              actionType: "SEARCH" as const,
              actionTarget: "breakfast",
              sortOrder: 0,
              organizationId: org.id,
              categoryId: categories[0].id,
            },
          ]
        : []),
      ...(categories.length > 1
        ? [
            {
              title: "Cooking Oils & Ghee",
              subtitle: "Pure & premium quality",
              imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&h=300&fit=crop",
              placement: "CATEGORY_TOP" as const,
              actionType: "SEARCH" as const,
              actionTarget: "cooking oil",
              sortOrder: 0,
              organizationId: org.id,
              categoryId: categories[1].id,
            },
          ]
        : []),
      ...(categories.length > 2
        ? [
            {
              title: "Fresh & Healthy Picks",
              subtitle: "Farm to table goodness",
              imageUrl: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800&h=300&fit=crop",
              placement: "CATEGORY_TOP" as const,
              actionType: "SEARCH" as const,
              actionTarget: "fresh",
              sortOrder: 0,
              organizationId: org.id,
              categoryId: categories[2].id,
            },
          ]
        : []),
      // Generic fallback — shown for categories without a specific banner
      {
        title: "Shop Smart, Save More",
        subtitle: "Best deals on everyday essentials",
        imageUrl: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=300&fit=crop",
        placement: "CATEGORY_TOP",
        actionType: "SEARCH",
        actionTarget: "deals",
        sortOrder: 10,
        organizationId: org.id,
      },
    ],
  });

  console.log(`Created ${banners.count} banners for ${org.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
