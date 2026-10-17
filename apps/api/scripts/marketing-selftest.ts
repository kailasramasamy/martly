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
import { recordSubscriptionCharge, startTrial } from "../src/services/marketing/subscriptions.js";

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

/** The one-time trial, upgrading out of it, and a renewing subscription's charge reported twice */
async function trialAndSubscription(userId: string) {
  const org = await prisma.organization.create({ data: { name: "Selftest Trial", slug: `selftest-trial-${Date.now()}` } });
  try {
    ok((await getEntitlements(prisma, org.id)).trial.available, "Trial offered to a new organisation");
    await startTrial(prisma, org.id);
    const onTrial = await getEntitlements(prisma, org.id);
    ok(onTrial.plan?.code === "GROWTH" && onTrial.promotions.planTotal === 2 && !onTrial.onPaidPlan && !!onTrial.trial.endsAt,
      "Trial: Growth with 2 promotions for 14 days, not a paid plan (no extras)");
    ok(await startTrial(prisma, org.id).then(() => false, () => true), "Trial can't be started twice");
    await buy(org.id, userId, "PRO");
    const pro = await prisma.orgPlanPeriod.findFirstOrThrow({ where: { organizationId: org.id, product: { code: "PRO" } } });
    ok(Math.round((pro.endsAt.getTime() - pro.startsAt.getTime()) / DAY) === 30, "Upgrading out of the trial starts now and carries no days");
    const growth = await prisma.adProduct.findUniqueOrThrow({ where: { code: "GROWTH" } });
    await prisma.marketingSubscription.create({ data: { organizationId: org.id, productId: growth.id, razorpaySubscriptionId: `sub_selftest_${Date.now()}`, createdById: userId, status: "ACTIVE" } });
    const sub = await prisma.marketingSubscription.findFirstOrThrow({ where: { organizationId: org.id } });
    const payment = { id: `pay_selftest_${Date.now()}`, amount: 117882 };
    const first = await recordSubscriptionCharge(prisma, sub.razorpaySubscriptionId, payment);
    const again = await recordSubscriptionCharge(prisma, sub.razorpaySubscriptionId, payment);
    const periods = await prisma.orgPlanPeriod.count({ where: { organizationId: org.id, product: { code: "GROWTH" }, isTrial: false } });
    ok(!!first?.number && Number(first.total) === 1178.82 && again === null && periods === 1, "A subscription charge grants one month and one invoice, even if reported twice");
  } finally {
    await prisma.marketingSubscription.deleteMany({ where: { organizationId: org.id } });
    await prisma.orgPlanPeriod.deleteMany({ where: { organizationId: org.id } });
    await prisma.adOrder.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
}

async function main() {
  const user = await prisma.user.findFirstOrThrow({ where: { email: "owner@demogrocers.dev" } });
  const org = await prisma.organization.create({ data: { name: "Selftest Org", slug: `selftest-${Date.now()}` } });
  try {
    ok((await newPromo(org.id, user.id)).charge === 402, "Free plan: promo refused with 402");
    await buy(org.id, user.id, "GROWTH");
    const a = await newPromo(org.id, user.id), b = await newPromo(org.id, user.id), c = await newPromo(org.id, user.id);
    ok(a.charge === "PLAN" && b.charge === "PLAN" && c.charge === 402, "Growth: 2 promotions (AI or manual) from plan, 3rd refused");
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
    const upgraded = await getEntitlements(prisma, org.id);
    const pro = await prisma.orgPlanPeriod.findFirstOrThrow({ where: { organizationId: org.id, product: { code: "PRO" } } });
    const extraDays = (pro.endsAt.getTime() - pro.startsAt.getTime()) / DAY - 30;
    ok(upgraded.plan?.code === "PRO" && extraDays > 11 && extraDays < 12.1, `Upgrade to Pro starts now with ~12 carried-over days (${extraDays.toFixed(1)})`);
    const queued = await prisma.orgPlanPeriod.findFirstOrThrow({ where: { organizationId: org.id, startsAt: { gt: new Date() } } });
    ok(queued.startsAt.getTime() === pro.endsAt.getTime(), "Queued Growth month moved behind the Pro period");
    const running = await prisma.promo.create({ data: { organizationId: org.id, createdById: user.id, brief: "selftest live", status: "LIVE", kind: "MANUAL" } });
    await prisma.banner.create({ data: { organizationId: org.id, promoId: running.id, title: "Live", imageUrl: "x", placement: "HERO_CAROUSEL" } });
    await prisma.orgPlanPeriod.updateMany({ where: { organizationId: org.id }, data: { endsAt: new Date(Date.now() - 1000), startsAt: new Date(Date.now() - 2 * DAY) } });
    await closeEndedPeriods(null, prisma);
    const live = await prisma.banner.count({ where: { promoId: running.id, isActive: true } });
    const ent = await getEntitlements(prisma, org.id);
    ok(live === 1 && ent.plan?.code === "FREE", "Plan expiry: back on Free, the running promotion keeps its banner");
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
main()
  .then(async () => trialAndSubscription((await prisma.user.findFirstOrThrow({ where: { email: "owner@demogrocers.dev" } })).id))
  .finally(() => prisma.$disconnect());
