/**
 * Exercises plan entitlements, promotion credits, upgrades and plan expiry on a throwaway organisation, then
 * deletes it. Local databases only: each test purchase uses up a GST invoice number.
 *
 *   cd apps/api && npx tsx scripts/marketing-selftest.ts
 */
import { PrismaClient } from "../generated/prisma/client.js";
import { chargePromotion, getEntitlements, refundPromotion } from "../src/services/marketing/entitlements.js";
import { fulfilAdOrder } from "../src/services/marketing/billing.js";
import { closeEndedPeriods } from "../src/services/marketing/renewals.js";

const prisma = new PrismaClient();
const ok = (cond: boolean, msg: string) => console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
const DAY = 86_400_000;

async function buy(orgId: string, userId: string, code: string) {
  const product = await prisma.adProduct.findUniqueOrThrow({ where: { code } });
  const order = await prisma.adOrder.create({ data: { organizationId: orgId, productId: product.id, unitPrice: product.price, subtotal: product.price, gstPercent: 18, total: product.price, createdById: userId } });
  return fulfilAdOrder(prisma, order.id, { offlineReference: "selftest" });
}
async function newPromo(orgId: string, userId: string) {
  const promo = await prisma.promo.create({ data: { organizationId: orgId, createdById: userId, brief: "selftest", status: "READY" } });
  try { return { promo, charge: await prisma.$transaction((tx) => chargePromotion(tx, promo)) }; }
  catch (e) { return { promo, charge: (e as Error & { statusCode?: number }).statusCode }; }
}

async function main() {
  const user = await prisma.user.findFirstOrThrow({ where: { email: "owner@demogrocers.dev" } });
  const org = await prisma.organization.create({ data: { name: "Selftest Org", slug: `selftest-${Date.now()}` } });
  try {
    ok((await newPromo(org.id, user.id)).charge === 402, "Free plan: promo refused with 402");
    await buy(org.id, user.id, "GROWTH");
    const a = await newPromo(org.id, user.id), b = await newPromo(org.id, user.id), c = await newPromo(org.id, user.id);
    ok(a.charge === "PLAN" && b.charge === "PLAN" && c.charge === 402, "Growth: 2 promos from plan, 3rd refused");
    await buy(org.id, user.id, "PROMO_TOPUP");
    const d = await newPromo(org.id, user.id);
    ok(d.charge === "TOPUP", "Top-up credit used after plan allowance");
    await refundPromotion(prisma, a.promo.id); await refundPromotion(prisma, a.promo.id);
    ok((await getEntitlements(prisma, org.id)).promotions.planLeft === 1, "Refund of a plan promo gives exactly one credit back (idempotent)");
    await refundPromotion(prisma, d.promo.id);
    ok((await getEntitlements(prisma, org.id)).promotions.topUpBalance === 1, "Refund of a top-up promo restores the bought credit");
    await buy(org.id, user.id, "GROWTH");
    const periods = await prisma.orgPlanPeriod.findMany({ where: { organizationId: org.id }, orderBy: { startsAt: "asc" } });
    ok(periods.length === 2 && periods[1].startsAt.getTime() === periods[0].endsAt.getTime(), "Second Growth month queues after the first");
    await buy(org.id, user.id, "PRO");
    const ent = await getEntitlements(prisma, org.id);
    const pro = await prisma.orgPlanPeriod.findFirstOrThrow({ where: { organizationId: org.id, product: { code: "PRO" } } });
    const extraDays = (pro.endsAt.getTime() - pro.startsAt.getTime()) / DAY - 30;
    ok(ent.plan?.code === "PRO" && extraDays > 11 && extraDays < 12.1, `Upgrade to Pro starts now with ~12 carried-over days (${extraDays.toFixed(1)})`);
    const queued = await prisma.orgPlanPeriod.findFirstOrThrow({ where: { organizationId: org.id, startsAt: { gt: new Date() } } });
    ok(queued.startsAt.getTime() === pro.endsAt.getTime(), "Queued Growth month moved behind the Pro period");
    for (let i = 0; i < 3; i++) await prisma.banner.create({ data: { organizationId: org.id, title: `B${i}`, imageUrl: "x", placement: "HERO_CAROUSEL" } });
    await prisma.orgPlanPeriod.updateMany({ where: { organizationId: org.id }, data: { endsAt: new Date(Date.now() - 1000), startsAt: new Date(Date.now() - 2 * DAY) } });
    await closeEndedPeriods(null, prisma);
    const on = await prisma.banner.count({ where: { organizationId: org.id, isActive: true } });
    ok(on === 1, `Plan expiry: back on Free, banners beyond 1 slot switched off (${on} on)`);
  } finally {
    await prisma.promotionCreditEntry.deleteMany({ where: { organizationId: org.id } });
    await prisma.promo.deleteMany({ where: { organizationId: org.id } });
    await prisma.orgPlanPeriod.deleteMany({ where: { organizationId: org.id } });
    await prisma.adOrder.deleteMany({ where: { organizationId: org.id } });
    await prisma.banner.deleteMany({ where: { organizationId: org.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id, data: { path: ["screen"], equals: "marketing-plan" } } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
}
main().finally(() => prisma.$disconnect());
