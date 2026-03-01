import { PrismaClient } from "../generated/prisma/index.js";
import { ensureReferralCode } from "../src/services/referral-code.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding referral data...");

  // Get Innovative Foods org
  const org = await prisma.organization.findFirst({ where: { slug: "innovative-foods" } });
  if (!org) {
    console.log("No org found (innovative-foods). Run main seed first.");
    return;
  }

  // Upsert referral config
  const config = await prisma.referralConfig.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      isEnabled: true,
      referrerReward: 50,
      refereeReward: 25,
      maxReferralsPerUser: 50,
    },
    update: {
      isEnabled: true,
    },
  });
  console.log(`Referral config: referrer=₹${config.referrerReward}, referee=₹${config.refereeReward}`);

  // Backfill referral codes for all users without one
  const usersWithoutCode = await prisma.user.findMany({
    where: { referralCode: null },
    select: { id: true, name: true },
  });

  for (const u of usersWithoutCode) {
    const code = await ensureReferralCode(prisma, u.id);
    console.log(`  ${u.name || u.id} → ${code}`);
  }

  // Create a sample referral (customer referred by owner)
  const owner = await prisma.user.findFirst({ where: { email: "owner@innovative.dev" } });
  const customer = await prisma.user.findFirst({ where: { email: "customer@martly.dev" } });

  if (owner && customer) {
    const existing = await prisma.referral.findUnique({
      where: {
        refereeId_organizationId: {
          refereeId: customer.id,
          organizationId: org.id,
        },
      },
    });

    if (!existing) {
      await prisma.referral.create({
        data: {
          referrerId: owner.id,
          refereeId: customer.id,
          organizationId: org.id,
          referrerReward: 50,
          refereeReward: 25,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
      console.log("Created sample COMPLETED referral: owner → customer");
    } else {
      console.log("Sample referral already exists");
    }
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
