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

  // Create sample products
  const products = await Promise.all(
    [
      { name: "Organic Bananas", sku: "FRUIT-001", description: "Fresh organic bananas, per bunch" },
      { name: "Whole Milk 1L", sku: "DAIRY-001", description: "Full cream whole milk, 1 liter" },
      { name: "Sourdough Bread", sku: "BAKERY-001", description: "Artisan sourdough loaf" },
    ].map((p) =>
      prisma.product.upsert({
        where: { sku: p.sku },
        update: {},
        create: p,
      }),
    ),
  );

  // Add products to store with prices
  for (const [i, product] of products.entries()) {
    await prisma.storeProduct.upsert({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
      update: {},
      create: {
        storeId: store.id,
        productId: product.id,
        price: [2.99, 4.49, 6.99][i],
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
