import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error("No organization found. Run db:seed first.");
    process.exit(1);
  }
  console.log(`Organization: ${org.name} (${org.id})`);

  const store = await prisma.store.findFirst({ select: { id: true, name: true } });
  if (!store) {
    console.error("No store found. Run db:seed first.");
    process.exit(1);
  }
  console.log(`Store: ${store.name} (${store.id})\n`);

  const storeId = store.id;

  // ── Create 3 membership plans ──────────────────────
  console.log("Creating membership plans...");

  // Clean existing plans
  await prisma.membershipPlan.deleteMany({ where: { organizationId: org.id } });

  const monthlyPlan = await prisma.membershipPlan.create({
    data: {
      organizationId: org.id,
      name: "Mart Plus Monthly",
      description: "Free delivery + bonus loyalty on every order",
      price: 49,
      duration: "MONTHLY",
      freeDelivery: true,
      loyaltyMultiplier: 2,
      isActive: true,
      sortOrder: 0,
    },
  });
  console.log(`  Created: ${monthlyPlan.name} - ₹49/month`);

  const quarterlyPlan = await prisma.membershipPlan.create({
    data: {
      organizationId: org.id,
      name: "Mart Plus Quarterly",
      description: "Save 12% vs monthly. Free delivery + bonus loyalty.",
      price: 129,
      duration: "QUARTERLY",
      freeDelivery: true,
      loyaltyMultiplier: 2,
      isActive: true,
      sortOrder: 1,
    },
  });
  console.log(`  Created: ${quarterlyPlan.name} - ₹129/quarter`);

  const annualPlan = await prisma.membershipPlan.create({
    data: {
      organizationId: org.id,
      name: "Mart Plus Annual",
      description: "Best value — free delivery + bonus loyalty all year!",
      price: 449,
      duration: "ANNUAL",
      freeDelivery: true,
      loyaltyMultiplier: 3,
      isActive: true,
      sortOrder: 2,
    },
  });
  console.log(`  Created: ${annualPlan.name} - ₹449/year`);

  // ── Set member prices on ~50 popular store products ────
  console.log("Setting member prices on popular products...");

  // Reset all member prices first
  await prisma.storeProduct.updateMany({
    where: { storeId, memberPrice: { not: null } },
    data: { memberPrice: null },
  });

  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, stock: { gt: 0 } },
    include: { product: { select: { name: true } } },
    take: 50,
    orderBy: [{ isFeatured: "desc" }, { price: "desc" }],
  });

  let memberPriceCount = 0;
  for (const sp of storeProducts) {
    const price = Number(sp.price);
    // 5–20% off for members depending on price range
    const discountPct = price > 500 ? 0.05 : price > 200 ? 0.10 : price > 50 ? 0.15 : 0.20;
    const memberPrice = Math.round(price * (1 - discountPct));
    await prisma.storeProduct.update({
      where: { id: sp.id },
      data: { memberPrice },
    });
    memberPriceCount++;
  }
  console.log(`  ${memberPriceCount} products with member prices\n`);

  // ── Create active membership for test customer (if exists) ─────
  const customer = await prisma.user.findUnique({ where: { email: "customer@martly.dev" } });
  if (customer) {
    console.log("Creating active membership for customer@martly.dev...");
    await prisma.userMembership.deleteMany({ where: { userId: customer.id, organizationId: org.id } });

    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.userMembership.create({
      data: {
        userId: customer.id,
        planId: monthlyPlan.id,
        organizationId: org.id,
        status: "ACTIVE",
        startDate: now,
        endDate,
        pricePaid: 49,
      },
    });
    console.log(`  Active monthly membership until ${endDate.toLocaleDateString()}\n`);
  } else {
    console.log("(Skipped customer membership — customer@martly.dev not found)\n");
  }

  // ── Verification ────
  const planCount = await prisma.membershipPlan.count({ where: { organizationId: org.id, isActive: true } });
  const memberPriced = await prisma.storeProduct.count({ where: { storeId, memberPrice: { not: null } } });
  console.log("--- Verification ---");
  console.log(`  Plans: ${planCount}`);
  console.log(`  Products with member prices: ${memberPriced}`);
  console.log("\nDone!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
