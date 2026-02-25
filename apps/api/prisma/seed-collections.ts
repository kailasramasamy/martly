import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const COLLECTIONS = [
  {
    title: "Weekend Breakfast Essentials",
    subtitle: "Everything for a perfect morning",
    slug: "weekend-breakfast-essentials",
    sortOrder: 1,
    productKeywords: ["Milk", "Bread", "Eggs", "Butter", "Tea", "Jam", "Paneer", "Curd"],
  },
  {
    title: "Quick Snack Attack",
    subtitle: "Grab and go favourites",
    slug: "quick-snack-attack",
    sortOrder: 2,
    productKeywords: ["Chips", "Biscuit", "Noodle", "Namkeen", "Chocolate", "Cookie", "Kurkure"],
  },
  {
    title: "Healthy & Organic",
    subtitle: "Good for you, good for the planet",
    slug: "healthy-organic",
    sortOrder: 3,
    productKeywords: ["Muesli", "Green Tea", "Almond", "Olive Oil", "Oats", "Honey", "Quinoa"],
  },
  {
    title: "New Arrivals",
    subtitle: "Just added to the store",
    slug: "new-arrivals",
    sortOrder: 4,
    productKeywords: [], // will use latest products by createdAt
  },
];

async function main() {
  // Find the first organization (Innovative Foods)
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.log("No organization found — skipping collection seeding");
    return;
  }

  for (const col of COLLECTIONS) {
    // Check if collection already exists
    const existing = await prisma.collection.findUnique({ where: { slug: col.slug } });
    if (existing) {
      console.log(`Collection "${col.title}" already exists — skipping`);
      continue;
    }

    // Find matching products
    let products;
    if (col.productKeywords.length === 0) {
      // New Arrivals: latest 8 products
      products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true },
      });
    } else {
      // Match by keyword in product name
      products = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: col.productKeywords.map((kw) => ({
            name: { contains: kw, mode: "insensitive" as const },
          })),
        },
        take: 10,
        select: { id: true },
      });
    }

    const collection = await prisma.collection.create({
      data: {
        title: col.title,
        subtitle: col.subtitle,
        slug: col.slug,
        sortOrder: col.sortOrder,
        organizationId: org.id,
        isActive: true,
        items: {
          create: products.map((p, idx) => ({
            productId: p.id,
            sortOrder: idx,
          })),
        },
      },
      include: { _count: { select: { items: true } } },
    });

    console.log(`Created "${collection.title}" with ${collection._count.items} products`);
  }

  console.log("Collection seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
