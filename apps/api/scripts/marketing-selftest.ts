/**
 * Exercises plan entitlements, promotion credits, own-product listings, the onboarding plan, the banner cap, upgrades and plan expiry on a throwaway organisation, then
 * deletes it. Local databases only: each test purchase uses up a GST invoice number.
 *
 *   cd apps/api && npx tsx scripts/marketing-selftest.ts
 */
import { PrismaClient } from "../generated/prisma/client.js";
import { chargePromotion, getEntitlements, refundPromotion } from "../src/services/marketing/entitlements.js";
import { fulfilAdOrder } from "../src/services/marketing/billing.js";
import { closeEndedPeriods } from "../src/services/marketing/renewals.js";
import { recordSubscriptionCharge } from "../src/services/marketing/subscriptions.js";
import { chargeAiImages } from "../src/services/marketing/ai-images.js";
import { launchStore } from "../src/services/onboarding/launch.js";
import { chargeListing, listingBalance, refundListing } from "../src/services/marketing/listing-credits.js";

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

/** Lists an own product, charging one listing; the 402 status when none is left */
async function newListing(orgId: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { name: `Selftest product ${Math.random()}`, organizationId: orgId } });
    await chargeListing(tx, orgId, product.id);
    return product;
  }).catch((e: Error & { statusCode?: number }) => e.statusCode);
}

/** Free lists 10 own products, bought listings come next, a deleted product gives its listing back, Growth raises the allowance to 25, and unlimited lists past it */
async function listingCredits(userId: string) {
  const org = await prisma.organization.create({ data: { name: "Selftest Listings", slug: `selftest-listings-${Date.now()}` } });
  try {
    const free = [];
    for (let i = 0; i < 10; i++) free.push(await newListing(org.id));
    ok(free.every((p) => typeof p === "object") && (await newListing(org.id)) === 402, "Free: 10 own products listed free, the 11th refused with 402");
    await buy(org.id, userId, "LISTING_TOPUP");
    const extra = await newListing(org.id);
    const afterExtra = await listingBalance(prisma, org.id);
    ok(typeof extra === "object" && afterExtra.extraBalance === 0 && afterExtra.used === 10, "Bought listing used after the free ones");
    const first = free[0] as { id: string };
    await prisma.$transaction(async (tx) => { await refundListing(tx, first.id); await tx.product.delete({ where: { id: first.id } }); });
    ok((await listingBalance(prisma, org.id)).planLeft === 1, "Deleting a free-listed product gives its listing back");
    await buy(org.id, userId, "GROWTH");
    const growth = (await getEntitlements(prisma, org.id)).listings;
    ok(growth.included === 25 && growth.planLeft === 16, `Growth: 25 included, 16 left after 9 used (${growth.planLeft})`);
    await prisma.listingCreditEntry.create({ data: { organizationId: org.id, delta: -16, reason: "ADJUST", fromPlan: true } });
    await prisma.organization.update({ where: { id: org.id }, data: { unlimitedListings: true } });
    ok(typeof (await newListing(org.id)) === "object", "Unlimited listings (beta store): lists past the plan's allowance");
  } finally {
    await prisma.listingCreditEntry.deleteMany({ where: { organizationId: org.id } });
    await prisma.product.deleteMany({ where: { organizationId: org.id } });
    await prisma.orgPlanPeriod.deleteMany({ where: { organizationId: org.id } });
    await prisma.adOrder.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
}

/** The Growth months a first launch includes, the hidden banner cap, and a renewing subscription's charge reported twice */
async function onboardingAndSubscription(userId: string) {
  const org = await prisma.organization.create({ data: { name: "Selftest Onboarding", slug: `selftest-onboarding-${Date.now()}` } });
  const town = await prisma.town.findFirstOrThrow();
  const store = (n: number) => prisma.store.create({ data: { organizationId: org.id, name: `Selftest ${n}`, slug: `selftest-${n}-${Date.now()}`, townId: town.id, address: "x", status: "PENDING" } });
  try {
    ok(!(await getEntitlements(prisma, org.id)).trial.available, "No self-serve trial is offered");
    await launchStore(prisma, (await store(1)).id);
    const launched = await getEntitlements(prisma, org.id);
    const period = await prisma.orgPlanPeriod.findFirstOrThrow({ where: { organizationId: org.id } });
    ok(launched.plan?.code === "GROWTH" && launched.onPaidPlan && launched.pushIncluded && Math.round((period.endsAt.getTime() - period.startsAt.getTime()) / DAY) === 90,
      "First launch: 90 days of Growth with notifications, extras allowed");
    await launchStore(prisma, (await store(2)).id);
    ok((await prisma.orgPlanPeriod.count({ where: { organizationId: org.id } })) === 1, "A second store's launch adds no more Growth");
    const { ownerBannerCap } = await prisma.marketingConfig.findUniqueOrThrow({ where: { id: "default" } });
    const full = await chargeAiImages(prisma, org.id, ownerBannerCap, "COLLECTION_BANNER");
    const over = await chargeAiImages(prisma, org.id, 1, "COLLECTION_BANNER").then(() => 0, (e: Error & { statusCode?: number }) => e.statusCode);
    ok(full?.count === ownerBannerCap && over === 402 && (await getEntitlements(prisma, org.id)).aiImages.packBalance === 0,
      `Banner cap: ${ownerBannerCap} a month, then 402, no packs`);
    const growth = await prisma.adProduct.findUniqueOrThrow({ where: { code: "GROWTH" } });
    await prisma.marketingSubscription.create({ data: { organizationId: org.id, productId: growth.id, razorpaySubscriptionId: `sub_selftest_${Date.now()}`, createdById: userId, status: "ACTIVE" } });
    const sub = await prisma.marketingSubscription.findFirstOrThrow({ where: { organizationId: org.id } });
    const payment = { id: `pay_selftest_${Date.now()}`, amount: 117882 };
    const first = await recordSubscriptionCharge(prisma, sub.razorpaySubscriptionId, payment);
    const again = await recordSubscriptionCharge(prisma, sub.razorpaySubscriptionId, payment);
    const periods = await prisma.orgPlanPeriod.count({ where: { organizationId: org.id, product: { code: "GROWTH" }, adOrderId: { not: null } } });
    ok(!!first?.number && Number(first.total) === 1178.82 && again === null && periods === 1, "A subscription charge grants one month and one invoice, even if reported twice");
  } finally {
    await prisma.aiImageCreditEntry.deleteMany({ where: { organizationId: org.id } });
    await prisma.store.deleteMany({ where: { organizationId: org.id } });
    await prisma.marketingSubscription.deleteMany({ where: { organizationId: org.id } });
    await prisma.orgPlanPeriod.deleteMany({ where: { organizationId: org.id } });
    await prisma.adOrder.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
}

/** Annual billing: a year per charge, a month's allowance at a time, and upgrades judged by price per day */
async function annualPlans(userId: string) {
  const org = await prisma.organization.create({ data: { name: "Selftest Annual", slug: `selftest-annual-${Date.now()}` } });
  const subscribe = async (code: string, interval: "MONTHLY" | "YEARLY", amount: number) => {
    const product = await prisma.adProduct.findUniqueOrThrow({ where: { code } });
    const sub = await prisma.marketingSubscription.create({
      data: { organizationId: org.id, productId: product.id, interval, razorpaySubscriptionId: `sub_annual_${code}_${interval}_${Date.now()}`, createdById: userId, status: "ACTIVE" },
    });
    await recordSubscriptionCharge(prisma, sub.razorpaySubscriptionId, { id: `pay_annual_${code}_${interval}_${Date.now()}`, amount });
  };
  try {
    await subscribe("GROWTH", "MONTHLY", 117882);
    await subscribe("GROWTH", "YEARLY", 1178820);
    const periods = await prisma.orgPlanPeriod.findMany({ where: { organizationId: org.id }, orderBy: { startsAt: "asc" } });
    const days = (p: { startsAt: Date; endsAt: Date }) => Math.round((p.endsAt.getTime() - p.startsAt.getTime()) / DAY);
    ok(periods.length === 2 && days(periods[1]) === 365 && periods[1].startsAt.getTime() === periods[0].endsAt.getTime(),
      "Growth monthly → annual: the year (365 days) starts when the paid month ends");
    await subscribe("PRO", "YEARLY", 2948820);
    const pro = await prisma.orgPlanPeriod.findFirstOrThrow({ where: { organizationId: org.id, product: { code: "PRO" } } });
    ok(pro.startsAt.getTime() <= Date.now() && days(pro) > 365, "Annual Pro over monthly Growth is an upgrade: starts now with the unused month carried over");
    const a = await newPromo(org.id, userId);
    await prisma.promotionCreditEntry.updateMany({ where: { promoId: a.promo.id }, data: { createdAt: new Date(Date.now() - 40 * DAY) } });
    const ent = await getEntitlements(prisma, org.id);
    ok(ent.plan?.billingInterval === "YEARLY" && ent.promotions.planTotal === 6 && ent.promotions.planLeft === 6,
      "Annual Pro: 6 promotions each month; last month's use doesn't count this month");
  } finally {
    await prisma.promotionCreditEntry.deleteMany({ where: { organizationId: org.id } });
    await prisma.promo.deleteMany({ where: { organizationId: org.id } });
    await prisma.marketingSubscription.deleteMany({ where: { organizationId: org.id } });
    await prisma.orgPlanPeriod.deleteMany({ where: { organizationId: org.id } });
    await prisma.adOrder.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
}

async function main() {
  const user = await prisma.user.findFirstOrThrow({ where: { email: "demo@martly.in" } });
  const org = await prisma.organization.create({ data: { name: "Selftest Org", slug: `selftest-${Date.now()}` } });
  try {
    ok((await newPromo(org.id, user.id)).charge === 402, "Free plan: promo refused with 402");
    await buy(org.id, user.id, "GROWTH");
    const a = await newPromo(org.id, user.id), b = await newPromo(org.id, user.id), c = await newPromo(org.id, user.id);
    ok(a.charge === "PLAN" && b.charge === "PLAN" && c.charge === 402, "Growth: 2 promotions from plan, 3rd refused");
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
  .then(async () => {
    const { id } = await prisma.user.findFirstOrThrow({ where: { email: "demo@martly.in" } });
    await onboardingAndSubscription(id);
    await annualPlans(id);
    await listingCredits(id);
  })
  .finally(() => prisma.$disconnect());
