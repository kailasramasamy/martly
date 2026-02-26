import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // Find Innovative Foods org
  const org = await prisma.organization.findFirst({ where: { slug: "innovative-foods" } });
  if (!org) {
    console.error("Organization 'innovative-foods' not found. Run db:seed first.");
    process.exit(1);
  }

  // Find customer user
  const customer = await prisma.user.findUnique({ where: { email: "customer@martly.dev" } });
  if (!customer) {
    console.error("Customer user not found. Run db:seed first.");
    process.exit(1);
  }

  // Upsert loyalty config
  const config = await prisma.loyaltyConfig.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      isEnabled: true,
      earnRate: 1, // 1 point per ₹100
      minRedeemPoints: 10,
      maxRedeemPercentage: 50,
    },
    update: {
      isEnabled: true,
      earnRate: 1,
      minRedeemPoints: 10,
      maxRedeemPercentage: 50,
    },
  });
  console.log(`✓ Loyalty config created/updated for ${org.name} (earnRate: ${config.earnRate}, maxRedeem: ${config.maxRedeemPercentage}%)`);

  // Upsert loyalty balance for customer
  const balance = await prisma.loyaltyBalance.upsert({
    where: {
      userId_organizationId: {
        userId: customer.id,
        organizationId: org.id,
      },
    },
    create: {
      userId: customer.id,
      organizationId: org.id,
      points: 150,
      totalEarned: 200,
      totalRedeemed: 50,
    },
    update: {
      points: 150,
      totalEarned: 200,
      totalRedeemed: 50,
    },
  });
  console.log(`✓ Loyalty balance: ${balance.points} points for ${customer.email}`);

  // Clear old sample transactions
  await prisma.loyaltyTransaction.deleteMany({
    where: { userId: customer.id, organizationId: org.id },
  });

  // Create sample transactions
  const now = new Date();
  const txns = [
    {
      userId: customer.id,
      organizationId: org.id,
      type: "EARN" as const,
      points: 80,
      balanceAfter: 80,
      description: "Earned from order — ₹8,000 order",
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      userId: customer.id,
      organizationId: org.id,
      type: "EARN" as const,
      points: 120,
      balanceAfter: 200,
      description: "Earned from order — ₹12,000 order",
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      userId: customer.id,
      organizationId: org.id,
      type: "REDEEM" as const,
      points: -50,
      balanceAfter: 150,
      description: "Redeemed at checkout",
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const txn of txns) {
    await prisma.loyaltyTransaction.create({ data: txn });
  }
  console.log(`✓ Created ${txns.length} sample loyalty transactions`);

  console.log("\nDone! Loyalty seed data ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
