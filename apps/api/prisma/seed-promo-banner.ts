/**
 * Seeds one live promotion that owns a home banner, so the "From promotion" banner handling can be tested. Idempotent.
 *
 *   cd apps/api && npx tsx prisma/seed-promo-banner.ts
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const BRIEF = "Weekend oil sale: 15% off cooking oils (seed)";

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@demogrocers.dev" }, select: { id: true } });
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: "demo-grocers" }, select: { id: true } });

  const existing = await prisma.promo.findFirst({ where: { organizationId: org.id, brief: BRIEF } });
  if (existing) return console.log(`Promo already seeded: ${existing.id}`);

  const startsAt = new Date();
  const endsAt = new Date(Date.now() + 3 * DAY);
  const promo = await prisma.promo.create({
    data: {
      organizationId: org.id, createdById: owner.id, brief: BRIEF, status: "LIVE",
      discountType: "PERCENTAGE", discountValue: 15, durationDays: 3, startsAt, endsAt,
    },
  });
  // An AI promotion's own launch banner: covered by its credit, so it takes no plan slot
  const banner = await prisma.banner.create({
    data: {
      title: "15% off cooking oils",
      subtitle: "This weekend only",
      imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=900&h=600&fit=crop",
      placement: "HERO_CAROUSEL",
      organizationId: org.id,
      promoId: promo.id,
      slotFree: true,
      startsAt,
      endsAt,
    },
  });
  console.log(`Seeded promo ${promo.id} owning banner ${banner.id}`);
}

main().finally(() => prisma.$disconnect());
