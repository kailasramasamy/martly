import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding test data for Coupons, Reviews, Wishlist, Delivery Zones...\n");

  // ── Look up existing data ──────────────────────────
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: "innovative-foods" } });
  const store = await prisma.store.findFirstOrThrow({ where: { slug: "bigmart" } });
  const customer = await prisma.user.findFirstOrThrow({ where: { email: "customer@martly.dev" } });
  const orgAdmin = await prisma.user.findFirstOrThrow({ where: { email: "owner@innovative.dev" } });

  // Get some store products for reviews/wishlist
  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId: store.id, isActive: true },
    include: { product: true, variant: true },
    take: 20,
    orderBy: { product: { name: "asc" } },
  });

  if (storeProducts.length === 0) {
    console.error("No store products found! Run product seeding first.");
    process.exit(1);
  }

  // ── 1. COUPONS ─────────────────────────────────────
  console.log("Creating coupons...");

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const twoMonthsFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const coupons = [
    {
      code: "WELCOME10",
      description: "10% off on your first order",
      discountType: "PERCENTAGE" as const,
      discountValue: 10,
      maxDiscount: 100,
      minOrderAmount: 200,
      usageLimit: 1000,
      perUserLimit: 1,
      startsAt: oneMonthAgo,
      expiresAt: twoMonthsFromNow,
      isActive: true,
      organizationId: org.id,
    },
    {
      code: "FLAT50",
      description: "Flat Rs.50 off on orders above Rs.500",
      discountType: "FLAT" as const,
      discountValue: 50,
      minOrderAmount: 500,
      usageLimit: 500,
      perUserLimit: 3,
      startsAt: oneMonthAgo,
      expiresAt: oneMonthFromNow,
      isActive: true,
      organizationId: org.id,
    },
    {
      code: "SAVE20",
      description: "20% off up to Rs.200",
      discountType: "PERCENTAGE" as const,
      discountValue: 20,
      maxDiscount: 200,
      minOrderAmount: 300,
      usageLimit: 200,
      perUserLimit: 2,
      startsAt: now,
      expiresAt: twoMonthsFromNow,
      isActive: true,
      organizationId: org.id,
    },
    {
      code: "EXPIRED25",
      description: "Expired coupon - 25% off",
      discountType: "PERCENTAGE" as const,
      discountValue: 25,
      maxDiscount: 150,
      minOrderAmount: 100,
      usageLimit: 100,
      perUserLimit: 1,
      startsAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: oneWeekAgo,
      isActive: true,
      organizationId: org.id,
    },
    {
      code: "INACTIVE15",
      description: "Disabled coupon - 15% off",
      discountType: "PERCENTAGE" as const,
      discountValue: 15,
      minOrderAmount: 100,
      usageLimit: 50,
      perUserLimit: 1,
      startsAt: oneMonthAgo,
      expiresAt: oneMonthFromNow,
      isActive: false,
      organizationId: org.id,
    },
    {
      code: "BIGORDER100",
      description: "Flat Rs.100 off on orders above Rs.1000",
      discountType: "FLAT" as const,
      discountValue: 100,
      minOrderAmount: 1000,
      usageLimit: null,
      perUserLimit: 5,
      startsAt: now,
      expiresAt: twoMonthsFromNow,
      isActive: true,
      organizationId: org.id,
    },
  ];

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }
  console.log(`  Created ${coupons.length} coupons`);

  // ── 2. DELIVERY ZONES ─────────────────────────────
  console.log("Creating delivery zones...");

  const zones = [
    {
      name: "Central Zone",
      pincodes: ["110001", "110002", "110003", "110004", "110005"],
      deliveryFee: 20,
      estimatedMinutes: 30,
      isActive: true,
      organizationId: org.id,
    },
    {
      name: "North Zone",
      pincodes: ["110006", "110007", "110008", "110009", "110010"],
      deliveryFee: 35,
      estimatedMinutes: 45,
      isActive: true,
      organizationId: org.id,
    },
    {
      name: "South Zone",
      pincodes: ["110011", "110012", "110013", "110014", "110015"],
      deliveryFee: 40,
      estimatedMinutes: 60,
      isActive: true,
      organizationId: org.id,
    },
    {
      name: "Extended Zone",
      pincodes: ["110016", "110017", "110018", "110019", "110020"],
      deliveryFee: 60,
      estimatedMinutes: 90,
      isActive: false,
      organizationId: org.id,
    },
  ];

  const createdZones = [];
  for (const z of zones) {
    // Skip if zone with same name already exists for this org
    const existing = await prisma.deliveryZone.findFirst({
      where: { name: z.name, organizationId: org.id },
    });
    if (existing) {
      createdZones.push(existing);
      continue;
    }
    const zone = await prisma.deliveryZone.create({ data: z });
    createdZones.push(zone);
  }

  // Link active zones to Bigmart store
  for (const zone of createdZones.filter((z) => z.isActive)) {
    await prisma.storeDeliveryZone.upsert({
      where: { storeId_deliveryZoneId: { storeId: store.id, deliveryZoneId: zone.id } },
      update: {},
      create: { storeId: store.id, deliveryZoneId: zone.id },
    });
  }
  console.log(`  Created/found ${zones.length} delivery zones, linked ${createdZones.filter((z) => z.isActive).length} to Bigmart`);

  // ── 3. REVIEWS ─────────────────────────────────────
  console.log("Creating reviews...");

  // Get ALL store products for comprehensive review coverage
  const allStoreProducts = await prisma.storeProduct.findMany({
    where: { storeId: store.id, isActive: true },
    include: { product: true },
  });
  const allUniqueProductIds = [...new Set(allStoreProducts.map((sp) => sp.productId))];

  const reviewTexts = [
    { rating: 5, title: "Excellent quality!", comment: "Fresh and well-packed. Will definitely order again.", isVerified: true, status: "APPROVED" as const },
    { rating: 4, title: "Good product", comment: "Nice quality, slightly pricey but worth it.", isVerified: true, status: "APPROVED" as const },
    { rating: 3, title: "Average", comment: "Decent quality but expected better packaging.", isVerified: false, status: "APPROVED" as const },
    { rating: 5, title: "Love it!", comment: "Best product in this category. Highly recommended!", isVerified: true, status: "APPROVED" as const },
    { rating: 4, title: "Very good", comment: "Consistent quality every time I order.", isVerified: true, status: "APPROVED" as const },
    { rating: 5, title: "Perfect!", comment: "Exactly what I was looking for. Great value for money.", isVerified: true, status: "APPROVED" as const },
    { rating: 4, title: "Good value", comment: "Reasonably priced with good quality.", isVerified: true, status: "APPROVED" as const },
    { rating: 3, title: "It's okay", comment: "Nothing special but does the job.", isVerified: false, status: "APPROVED" as const },
    { rating: 5, title: "Amazing!", comment: "Top-notch product. Fast delivery too.", isVerified: true, status: "APPROVED" as const },
    { rating: 4, title: "Quite nice", comment: "Good quality and arrived fresh.", isVerified: true, status: "APPROVED" as const },
    { rating: 5, title: "Highly recommend", comment: "Best in class, always buy this brand.", isVerified: true, status: "APPROVED" as const },
    { rating: 3, title: "Decent", comment: "Gets the job done. Nothing exceptional.", isVerified: false, status: "APPROVED" as const },
    { rating: 4, title: "Reliable choice", comment: "Always consistent quality. Happy customer.", isVerified: true, status: "APPROVED" as const },
    { rating: 5, title: "Superb!", comment: "Outstanding freshness and taste.", isVerified: true, status: "APPROVED" as const },
    { rating: 4, title: "Worth the price", comment: "Good value for money. Would buy again.", isVerified: true, status: "APPROVED" as const },
    { rating: 2, title: "Not great", comment: "Product was okay but delivery was delayed.", isVerified: false, status: "PENDING" as const },
    { rating: 1, title: "Disappointed", comment: "Product was damaged when delivered.", isVerified: false, status: "REJECTED" as const },
    { rating: 2, title: "Could be better", comment: "Quality has gone down compared to last time.", isVerified: false, status: "PENDING" as const },
  ];

  // Delete existing reviews and re-create for all products
  await prisma.review.deleteMany({ where: { userId: customer.id, storeId: store.id } });

  let reviewCount = 0;
  for (let i = 0; i < allUniqueProductIds.length; i++) {
    const productId = allUniqueProductIds[i];
    // Use mostly positive approved reviews (first 15 entries), cycle through them
    const r = reviewTexts[i % 15]; // Skip the last 3 (pending/rejected) for most products

    try {
      await prisma.review.create({
        data: {
          userId: customer.id,
          productId,
          storeId: store.id,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          isVerified: r.isVerified,
          status: r.status,
        },
      });
      reviewCount++;
    } catch (e) {
      // Skip if product doesn't exist or duplicate
    }
  }
  console.log(`  Created ${reviewCount} reviews for ALL store products`);

  // ── 4. WISHLIST ────────────────────────────────────
  console.log("Creating wishlist items...");

  const wishlistProductIds = allUniqueProductIds.slice(0, 8);
  let wishlistCount = 0;
  for (const productId of wishlistProductIds) {
    try {
      await prisma.wishlistItem.upsert({
        where: { userId_productId: { userId: customer.id, productId } },
        update: {},
        create: { userId: customer.id, productId },
      });
      wishlistCount++;
    } catch (e) {
      // Skip if product doesn't exist
    }
  }
  console.log(`  Created ${wishlistCount} wishlist items`);

  // ── 5. ORDER STATUS LOGS ──────────────────────────
  console.log("Adding status logs to existing orders...");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "asc" },
  });

  for (const order of orders) {
    // Check if logs already exist
    const existingLogs = await prisma.orderStatusLog.count({ where: { orderId: order.id } });
    if (existingLogs > 0) continue;

    // Create status logs based on current order status
    const statusSequence = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];
    const currentIndex = statusSequence.indexOf(order.status);

    if (currentIndex >= 0) {
      const baseTime = order.createdAt.getTime();
      for (let i = 0; i <= currentIndex; i++) {
        await prisma.orderStatusLog.create({
          data: {
            orderId: order.id,
            status: statusSequence[i] as any,
            createdAt: new Date(baseTime + i * 10 * 60 * 1000), // 10 min intervals
          },
        });
      }
    } else if (order.status === "CANCELLED") {
      await prisma.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: "PENDING",
          createdAt: order.createdAt,
        },
      });
      await prisma.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: "CANCELLED",
          note: "Cancelled by customer",
          createdAt: new Date(order.createdAt.getTime() + 5 * 60 * 1000),
        },
      });
    }
  }
  console.log(`  Added status logs for ${orders.length} orders`);

  // ── Summary ────────────────────────────────────────
  console.log("\n=== Seeding Summary ===");
  console.log(`Coupons:        ${coupons.length} (active: ${coupons.filter((c) => c.isActive).length})`);
  console.log(`Delivery Zones: ${zones.length} (active: ${zones.filter((z) => z.isActive).length})`);
  console.log(`Reviews:        ${reviewCount} for customer@martly.dev`);
  console.log(`Wishlist:       ${wishlistCount} items for customer@martly.dev`);
  console.log(`Order Logs:     ${orders.length} orders updated`);
  console.log("\n=== Test Coupon Codes ===");
  console.log("WELCOME10   - 10% off (max Rs.100), min order Rs.200");
  console.log("FLAT50      - Flat Rs.50 off, min order Rs.500");
  console.log("SAVE20      - 20% off (max Rs.200), min order Rs.300");
  console.log("BIGORDER100 - Flat Rs.100 off, min order Rs.1000");
  console.log("EXPIRED25   - Expired (should fail validation)");
  console.log("INACTIVE15  - Disabled (should fail validation)");
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
