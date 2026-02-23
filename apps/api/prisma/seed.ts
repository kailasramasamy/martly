import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { slug: "demo-grocers" },
    update: {},
    create: {
      name: "Demo Grocers",
      slug: "demo-grocers",
    },
  });

  // Create demo admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@martly.dev" },
    update: { passwordHash },
    create: {
      email: "admin@martly.dev",
      name: "Admin User",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  // Create demo store
  const store = await prisma.store.upsert({
    where: { slug: "downtown-mart" },
    update: {},
    create: {
      organizationId: org.id,
      name: "Downtown Mart",
      slug: "downtown-mart",
      address: "123 Main Street, Anytown, USA",
      phone: "+1-555-0100",
      status: "ACTIVE",
    },
  });

  // Assign admin to store
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: admin.id, storeId: store.id } },
    update: {},
    create: {
      userId: admin.id,
      storeId: store.id,
      role: "STORE_MANAGER",
    },
  });

  // Create categories
  const categoryTree = [
    {
      name: "Food", slug: "food", sortOrder: 0, children: [
        { name: "Fruits", slug: "fruits", sortOrder: 0 },
        { name: "Vegetables", slug: "vegetables", sortOrder: 1 },
        { name: "Dairy", slug: "dairy", sortOrder: 2 },
        { name: "Grains & Cereals", slug: "grains-cereals", sortOrder: 3 },
        { name: "Cooking Oil", slug: "cooking-oil", sortOrder: 4 },
        { name: "Spices & Masala", slug: "spices-masala", sortOrder: 5 },
        { name: "Snacks", slug: "snacks", sortOrder: 6 },
        { name: "Beverages", slug: "beverages", sortOrder: 7 },
        { name: "Frozen Food", slug: "frozen-food", sortOrder: 8 },
        { name: "Bakery", slug: "bakery", sortOrder: 9 },
        { name: "Pulses & Lentils", slug: "pulses-lentils", sortOrder: 10 },
        { name: "Dry Fruits & Nuts", slug: "dry-fruits-nuts", sortOrder: 11 },
        { name: "Canned & Packaged", slug: "canned-packaged", sortOrder: 12 },
        { name: "Sauces & Condiments", slug: "sauces-condiments", sortOrder: 13 },
        { name: "Meat", slug: "meat", sortOrder: 14 },
        { name: "Eggs", slug: "eggs", sortOrder: 15 },
        { name: "Ready to Eat", slug: "ready-to-eat", sortOrder: 16 },
        { name: "Tea & Coffee", slug: "tea-coffee", sortOrder: 17 },
        { name: "Chocolates & Sweets", slug: "chocolates-sweets", sortOrder: 18 },
      ],
    },
    {
      name: "Personal Care", slug: "personal-care", sortOrder: 1, children: [
        { name: "Face Wash", slug: "face-wash", sortOrder: 0 },
        { name: "Shampoo", slug: "shampoo", sortOrder: 1 },
        { name: "Soap", slug: "soap", sortOrder: 2 },
        { name: "Skincare", slug: "skincare", sortOrder: 3 },
        { name: "Haircare", slug: "haircare", sortOrder: 4 },
        { name: "Oral Care", slug: "oral-care", sortOrder: 5 },
        { name: "Deodorant", slug: "deodorant", sortOrder: 6 },
      ],
    },
    {
      name: "Household", slug: "household", sortOrder: 2, children: [
        { name: "Floor Cleaner", slug: "floor-cleaner", sortOrder: 0 },
        { name: "Detergent", slug: "detergent", sortOrder: 1 },
        { name: "Dishwash", slug: "dishwash", sortOrder: 2 },
        { name: "Kitchen Supplies", slug: "kitchen-supplies", sortOrder: 3 },
        { name: "Insect Repellent", slug: "insect-repellent", sortOrder: 4 },
        { name: "Air Freshener", slug: "air-freshener", sortOrder: 5 },
        { name: "Garbage Bags", slug: "garbage-bags", sortOrder: 6 },
      ],
    },
    {
      name: "Baby Care", slug: "baby-care", sortOrder: 3, children: [
        { name: "Diapers", slug: "diapers", sortOrder: 0 },
        { name: "Baby Food", slug: "baby-food", sortOrder: 1 },
        { name: "Baby Skincare", slug: "baby-skincare", sortOrder: 2 },
      ],
    },
    {
      name: "OTC Pharma", slug: "otc-pharma", sortOrder: 4, children: [
        { name: "Pain Relief", slug: "pain-relief", sortOrder: 0 },
        { name: "Cold & Cough", slug: "cold-cough", sortOrder: 1 },
        { name: "Digestive", slug: "digestive", sortOrder: 2 },
        { name: "Antiseptic", slug: "antiseptic", sortOrder: 3 },
      ],
    },
    {
      name: "Pet Care", slug: "pet-care", sortOrder: 5, children: [
        { name: "Pet Food", slug: "pet-food", sortOrder: 0 },
        { name: "Pet Hygiene", slug: "pet-hygiene", sortOrder: 1 },
      ],
    },
  ];

  for (const parent of categoryTree) {
    const parentCat = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, sortOrder: parent.sortOrder },
      create: { name: parent.name, slug: parent.slug, sortOrder: parent.sortOrder },
    });
    for (const child of parent.children ?? []) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, sortOrder: child.sortOrder, parentId: parentCat.id },
        create: { name: child.name, slug: child.slug, sortOrder: child.sortOrder, parentId: parentCat.id },
      });
    }
  }
  console.log("Categories seeded!");

  // Create sample products with variants
  const sampleProducts = [
    { name: "Organic Bananas", sku: "FRUIT-001", description: "Fresh organic bananas, per bunch", productType: "FRESH_PRODUCE" as const, variant: { name: "1 Bunch", unitType: "PIECE" as const, unitValue: 1 } },
    { name: "Whole Milk 1L", sku: "DAIRY-001", description: "Full cream whole milk, 1 liter", productType: "DAIRY" as const, variant: { name: "1 Liter", unitType: "LITER" as const, unitValue: 1 } },
    { name: "Sourdough Bread", sku: "BAKERY-001", description: "Artisan sourdough loaf", productType: "BAKERY" as const, variant: { name: "1 Loaf", unitType: "PIECE" as const, unitValue: 1 } },
  ];

  const products = [];
  for (const p of sampleProducts) {
    const existing = await prisma.productVariant.findUnique({ where: { sku: p.sku } });
    if (existing) {
      const product = await prisma.product.findFirst({ where: { variants: { some: { sku: p.sku } } }, include: { variants: true } });
      if (product) { products.push(product); continue; }
    }
    const product = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        productType: p.productType,
        variants: { create: { name: p.variant.name, sku: p.sku, unitType: p.variant.unitType, unitValue: p.variant.unitValue } },
      },
      include: { variants: true },
    });
    products.push(product);
  }

  // Add products to store with prices
  const prices = [2.99, 4.49, 6.99];
  for (const [i, product] of products.entries()) {
    const variant = product.variants[0];
    await prisma.storeProduct.upsert({
      where: { storeId_variantId: { storeId: store.id, variantId: variant.id } },
      update: {},
      create: {
        storeId: store.id,
        productId: product.id,
        variantId: variant.id,
        price: prices[i],
        stock: 100,
        isActive: true,
      },
    });
  }

  console.log("Seeding complete!");
  console.log({ org: org.name, admin: admin.email, store: store.name, products: products.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
