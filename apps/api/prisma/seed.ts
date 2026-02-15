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
