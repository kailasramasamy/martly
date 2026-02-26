/**
 * Seed script to populate test data for the home feed:
 * - Ensure customer user exists
 * - Map collection items to products that exist in Bigmart
 * - Add discounts to store products (for Deals section)
 * - Mark products as featured
 * - Create orders with past dates (for Buy Again section)
 */
import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── 1. Find the store (Bigmart) ──
  const store = await prisma.store.findFirst({
    where: { slug: "bigmart" },
    select: { id: true, organizationId: true },
  });
  if (!store) {
    console.log("Bigmart store not found — trying first store");
  }
  const targetStore = store ?? await prisma.store.findFirstOrThrow({ select: { id: true, organizationId: true } });
  console.log(`Using store: ${targetStore.id}`);

  // ── 2. Ensure customer user exists ──
  let customer = await prisma.user.findUnique({ where: { email: "customer@martly.dev" } });
  if (!customer) {
    const hash = await bcrypt.hash("customer123", 10);
    customer = await prisma.user.create({
      data: {
        email: "customer@martly.dev",
        name: "Test Customer",
        passwordHash: hash,
        role: "CUSTOMER",
        phone: "+919876543210",
      },
    });
    console.log("Created customer user: customer@martly.dev / customer123");
  } else {
    // Update password in case it's wrong
    const hash = await bcrypt.hash("customer123", 10);
    customer = await prisma.user.update({
      where: { id: customer.id },
      data: { passwordHash: hash },
    });
    console.log("Updated customer password");
  }

  // Ensure customer has an address
  const addressCount = await prisma.userAddress.count({ where: { userId: customer.id } });
  if (addressCount === 0) {
    await prisma.userAddress.create({
      data: {
        userId: customer.id,
        label: "Home",
        address: "42 MG Road, Indiranagar, Bangalore 560038",
        isDefault: true,
      },
    });
    console.log("Created customer address");
  }

  // ── 3. Get all store products for this store (with product details) ──
  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId: targetStore.id, isActive: true },
    include: {
      product: { include: { category: true } },
      variant: true,
    },
    take: 500,
  });
  console.log(`Found ${storeProducts.length} store products`);

  // ── 4. Update collections to reference products mapped to this store ──
  const collections = await prisma.collection.findMany({
    include: { items: { include: { product: true } } },
  });

  // Build lookup: product name keyword → store products
  const spByKeyword = (keyword: string) =>
    storeProducts.filter((sp) =>
      sp.product.name.toLowerCase().includes(keyword.toLowerCase())
    );

  const COLLECTION_KEYWORDS: Record<string, string[]> = {
    "weekend-breakfast-essentials": ["Milk", "Bread", "Egg", "Butter", "Tea", "Curd", "Paneer", "Coffee", "Rusk", "Ghee"],
    "quick-snack-attack": ["Chips", "Biscuit", "Noodle", "Namkeen", "Chocolate", "Cookie", "Bhujia", "Kurkure"],
    "healthy-organic": ["Oat", "Muesli", "Green Tea", "Cashew", "Almond", "Olive", "Honey", "Raisin"],
    "new-arrivals": [], // will pick random recent products
  };

  for (const col of collections) {
    const keywords = COLLECTION_KEYWORDS[col.slug];
    if (!keywords) continue;

    let matchedProductIds: string[];

    if (keywords.length === 0) {
      // New Arrivals: pick the most recently added store products
      matchedProductIds = storeProducts
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((sp) => sp.product.id);
    } else {
      const matched = new Set<string>();
      for (const kw of keywords) {
        for (const sp of spByKeyword(kw)) {
          matched.add(sp.product.id);
        }
      }
      matchedProductIds = [...matched].slice(0, 12);
    }

    // Deduplicate product IDs
    const uniqueProductIds = [...new Set(matchedProductIds)];

    if (uniqueProductIds.length === 0) {
      console.log(`  ${col.title}: no matching store products found, skipping`);
      continue;
    }

    // Replace collection items
    await prisma.collectionItem.deleteMany({ where: { collectionId: col.id } });
    await prisma.collectionItem.createMany({
      data: uniqueProductIds.map((productId, idx) => ({
        collectionId: col.id,
        productId,
        sortOrder: idx,
      })),
    });
    console.log(`  ${col.title}: linked ${uniqueProductIds.length} store products`);
  }

  // ── 5. Add discounts to ~15 store products ──
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Pick products without existing discounts
  const noDiscountSPs = storeProducts.filter((sp) => !sp.discountType);
  const toDiscount = noDiscountSPs.slice(0, 15);

  for (let i = 0; i < toDiscount.length; i++) {
    const sp = toDiscount[i];
    const isPercentage = i % 2 === 0;
    await prisma.storeProduct.update({
      where: { id: sp.id },
      data: {
        discountType: isPercentage ? "PERCENTAGE" : "FLAT",
        discountValue: isPercentage ? (10 + (i % 4) * 5) : (Math.round(Number(sp.price) * 0.15)),
        discountStart: oneWeekAgo,
        discountEnd: oneWeekLater,
      },
    });
  }
  console.log(`Added discounts to ${toDiscount.length} store products`);

  // ── 6. Mark ~10 more products as featured ──
  const notFeatured = storeProducts.filter((sp) => !sp.isFeatured);
  const toFeature = notFeatured.slice(0, 10);
  for (const sp of toFeature) {
    await prisma.storeProduct.update({
      where: { id: sp.id },
      data: { isFeatured: true },
    });
  }
  console.log(`Marked ${toFeature.length} additional products as featured`);

  // ── 7. Create orders with past dates for "Buy Again" ──
  const existingOrders = await prisma.order.count({
    where: { userId: customer.id, storeId: targetStore.id },
  });

  if (existingOrders > 0) {
    console.log(`Customer already has ${existingOrders} orders — skipping order creation`);
  } else {
    // Pick diverse products for orders
    const orderProducts = storeProducts.slice(0, 20);

    // Order 1: 2 weeks ago, DELIVERED
    const order1Items = orderProducts.slice(0, 5);
    await createOrder(customer.id, targetStore.id, order1Items, "DELIVERED", daysAgo(14));

    // Order 2: 1 week ago, DELIVERED
    const order2Items = orderProducts.slice(3, 8); // some overlap with order 1
    await createOrder(customer.id, targetStore.id, order2Items, "DELIVERED", daysAgo(7));

    // Order 3: 3 days ago, CONFIRMED
    const order3Items = orderProducts.slice(6, 10);
    await createOrder(customer.id, targetStore.id, order3Items, "CONFIRMED", daysAgo(3));

    // Order 4: yesterday, DELIVERED (most recent)
    const order4Items = orderProducts.slice(10, 15);
    await createOrder(customer.id, targetStore.id, order4Items, "DELIVERED", daysAgo(1));

    console.log("Created 4 orders with past dates");
  }

  console.log("\nHome feed test data seeded successfully!");
  console.log("\nTest with:");
  console.log(`  curl http://localhost:7001/api/v1/home/${targetStore.id}`);
  console.log("  Login: customer@martly.dev / customer123");
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function createOrder(
  userId: string,
  storeId: string,
  storeProducts: any[],
  status: string,
  createdAt: Date,
) {
  let totalAmount = 0;
  const items = storeProducts.map((sp) => {
    const quantity = 1 + Math.floor(Math.random() * 3);
    const unitPrice = Number(sp.price);
    const total = unitPrice * quantity;
    totalAmount += total;
    return {
      productId: sp.product.id,
      variantId: sp.variant.id,
      storeProductId: sp.id,
      quantity,
      unitPrice,
      totalPrice: total,
    };
  });

  await prisma.order.create({
    data: {
      userId,
      storeId,
      status: status as any,
      paymentStatus: "PAID",
      paymentMethod: "COD",
      totalAmount,
      deliveryAddress: "42 MG Road, Indiranagar, Bangalore 560038",
      createdAt,
      updatedAt: createdAt,
      items: { create: items },
    },
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
