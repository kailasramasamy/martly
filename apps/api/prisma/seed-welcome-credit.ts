/**
 * Seeds welcome-credit campaigns for testing: Martly's ₹50 for every new customer, and a ₹30 one funded by the
 * first real (non-template) store. Re-running leaves existing campaigns alone.
 *
 *   cd apps/api && npx tsx prisma/seed-welcome-credit.ts
 */
import { CREDIT_DEFAULTS } from "@martly/shared/constants";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  if (!(await prisma.creditCampaign.findFirst({ where: { storeId: null } }))) {
    await prisma.creditCampaign.create({
      data: { ...CREDIT_DEFAULTS, budget: 5000, createdBy: admin?.id },
    });
    console.log("Created Martly ₹50 welcome credit (budget ₹5,000)");
  }

  const store = await prisma.store.findFirst({
    where: { status: "ACTIVE", organization: { isTemplate: false } }, orderBy: { createdAt: "asc" },
  });
  if (!store) throw new Error("No live store to fund a store campaign");
  if (!(await prisma.creditCampaign.findFirst({ where: { storeId: store.id } }))) {
    await prisma.creditCampaign.create({
      data: {
        storeId: store.id, organizationId: store.organizationId, amount: 30, minOrderAmount: 249, validDays: 14, budget: 1500,
        headline: `₹30 off your first ${store.name} order`,
        translations: { ta: { headline: `${store.name} முதல் ஆர்டருக்கு ₹30 தள்ளுபடி` } },
        createdBy: admin?.id,
      },
    });
    console.log(`Created ${store.name} ₹30 welcome credit (budget ₹1,500)`);
  }
}

main().finally(() => prisma.$disconnect());
