import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: "innovative-foods" } });
  if (!org) {
    console.error("Organization 'innovative-foods' not found. Run db:seed first.");
    process.exit(1);
  }

  const customer = await prisma.user.findUnique({ where: { email: "customer@martly.dev" } });
  if (!customer) {
    console.error("Customer user not found. Run db:seed first.");
    process.exit(1);
  }

  const storeId = "375d5737-069b-42f0-9791-1cc8390c0993"; // Bigmart

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

  // ── Set member prices on popular store products ────
  console.log("\nSetting member prices on popular products...");

  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true },
    include: { product: { select: { name: true } } },
    take: 10,
    orderBy: { isFeatured: "desc" },
  });

  for (const sp of storeProducts) {
    const price = Number(sp.price);
    const memberPrice = Math.round(price * 0.8); // 20% off for members
    await prisma.storeProduct.update({
      where: { id: sp.id },
      data: { memberPrice },
    });
    console.log(`  ${sp.product.name}: ₹${price} → ₹${memberPrice} (member)`);
  }

  // ── Create active membership for test customer ─────
  console.log("\nCreating active membership for customer@martly.dev...");

  await prisma.userMembership.deleteMany({ where: { userId: customer.id, organizationId: org.id } });

  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const membership = await prisma.userMembership.create({
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

  console.log(`  Created membership: ${membership.id}`);
  console.log(`  Valid: ${now.toLocaleDateString()} → ${endDate.toLocaleDateString()}`);

  console.log("\n✓ Membership seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
