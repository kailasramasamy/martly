import { Prisma, type AdProduct, type Organization, type PrismaClient } from "../../../generated/prisma/client.js";
import { cancelRazorpaySubscription, createRazorpayPlan, createRazorpaySubscription, getRazorpayKeyId } from "../payment.js";
import { BillingError, grantPlan } from "./billing.js";
import { getMarketingConfig, nextInvoiceNumber, quote } from "./config.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 14;
const TRIAL_PLAN_CODE = "GROWTH";
/** Subscriptions that still bill (or will): the one an organisation has at most */
const OPEN = ["CREATED", "ACTIVE", "PENDING", "HALTED"] as const;

class SubscriptionError extends Error {
  name = "SubscriptionError";
  constructor(message: string, public statusCode = 409) {
    super(message);
  }
}

/** The monthly Razorpay plan for this price (GST included), made the first time and again whenever the price changes */
async function razorpayPlanFor(prisma: PrismaClient, product: AdProduct) {
  const { gstPercent } = await getMarketingConfig(prisma);
  const amount = Math.round(quote(Number(product.price), 1, gstPercent, true).total * 100);
  if (product.razorpayPlanId && product.razorpayPlanAmount === amount) return { planId: product.razorpayPlanId, amount };
  const planId = await createRazorpayPlan(`Martly ${product.name} plan`, amount);
  await prisma.adProduct.update({ where: { id: product.id }, data: { razorpayPlanId: planId, razorpayPlanAmount: amount } });
  return { planId, amount };
}

/** When billing for a new plan should start: now for an upgrade (or nothing running), else when the current plan ends */
async function billingStart(prisma: PrismaClient, organizationId: string, product: AdProduct) {
  const now = new Date();
  const [inForce, last] = await Promise.all([
    prisma.orgPlanPeriod.findFirst({ where: { organizationId, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: "desc" }, include: { product: true } }),
    prisma.orgPlanPeriod.findFirst({ where: { organizationId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" } }),
  ]);
  const upgrade = !inForce || Number(product.price) > Number(inForce.product.price);
  return { upgrade, startAt: upgrade ? undefined : last!.endsAt };
}

/**
 * Starts a plan that renews monthly. An upgrade replaces the running subscription now; the same or a cheaper plan
 * sets up its mandate now and is first charged when the current month (or trial) ends.
 */
export async function startSubscription(prisma: PrismaClient, organizationId: string, product: AdProduct, createdById: string) {
  if (product.kind !== "STORE_PLAN" || !product.isActive || Number(product.price) <= 0) throw new BillingError("Choose a paid plan");
  const current = await prisma.marketingSubscription.findFirst({
    where: { organizationId, status: { in: [...OPEN] }, cancelAtPeriodEnd: false }, include: { product: true },
  });
  if (current?.productId === product.id && current.status !== "CREATED") throw new SubscriptionError(`Your ${product.name} plan already renews automatically`);
  const { upgrade, startAt } = await billingStart(prisma, organizationId, product);
  if (current) {
    // An unpaid checkout or an upgrade ends the old subscription now; a downgrade lets the paid month finish
    const now = current.status === "CREATED" || upgrade;
    await cancelRazorpaySubscription(current.razorpaySubscriptionId, !now);
    await prisma.marketingSubscription.update({ where: { id: current.id }, data: now ? { status: "CANCELLED" } : { cancelAtPeriodEnd: true } });
  }
  const { planId, amount } = await razorpayPlanFor(prisma, product);
  const subscription = await createRazorpaySubscription(planId, { organizationId, productId: product.id }, startAt);
  await prisma.marketingSubscription.create({
    data: { organizationId, productId: product.id, razorpaySubscriptionId: subscription.id, startAt: startAt ?? null, createdById },
  });
  return { subscriptionId: subscription.id, keyId: getRazorpayKeyId(), amount, startsAt: startAt ?? null };
}

/**
 * One monthly charge of a subscription: a paid order with its GST invoice, and a month of the plan. The checkout
 * handler and the webhook both report the first charge, so the payment id makes the second report a no-op.
 */
export async function recordSubscriptionCharge(prisma: PrismaClient, razorpaySubscriptionId: string, payment: { id: string; amount: number }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const sub = await tx.marketingSubscription.findUnique({ where: { razorpaySubscriptionId }, include: { product: true, organization: true } });
      if (!sub || (await tx.adOrder.findUnique({ where: { razorpayPaymentId: payment.id } }))) return null;
      const config = await getMarketingConfig(tx);
      const org = sub.organization;
      const total = payment.amount / 100;
      const amounts = quote(Math.round((total * 10000) / (100 + config.gstPercent)) / 100, 1, config.gstPercent, org.billingState === config.sellerState);
      const order = await tx.adOrder.create({
        data: {
          organizationId: org.id, productId: sub.productId, ...amounts, status: "PAID", paidAt: new Date(), razorpayPaymentId: payment.id,
          number: await nextInvoiceNumber(tx, config.invoicePrefix), billing: billingOf(org), createdById: sub.createdById,
        },
      });
      await grantPlan(tx, order, sub.product, org.id);
      await tx.marketingSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE" } });
      return order;
    });
  } catch (err) {
    // The other report of the same payment won the race
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

const billingOf = (org: Organization) => ({ name: org.billingName ?? org.name, gstin: org.gstin, address: org.billingAddress, state: org.billingState });

/** Turns auto-renew off: a subscription not charged yet ends now, a paid one at the end of its month */
export async function cancelSubscription(prisma: PrismaClient, organizationId: string) {
  const sub = await prisma.marketingSubscription.findFirst({ where: { organizationId, status: { in: [...OPEN] }, cancelAtPeriodEnd: false } });
  if (!sub) throw new SubscriptionError("Nothing is set to renew");
  const charged = sub.status !== "CREATED";
  await cancelRazorpaySubscription(sub.razorpaySubscriptionId, charged);
  await prisma.marketingSubscription.update({ where: { id: sub.id }, data: charged ? { cancelAtPeriodEnd: true } : { status: "CANCELLED" } });
}

/** Razorpay's view of a subscription changed (activated, pending, halted, cancelled or completed) */
export async function updateSubscriptionStatus(prisma: PrismaClient, razorpaySubscriptionId: string, status: "ACTIVE" | "PENDING" | "HALTED" | "CANCELLED" | "COMPLETED") {
  const { count } = await prisma.marketingSubscription.updateMany({ where: { razorpaySubscriptionId }, data: { status } });
  return count > 0;
}

/** The once-per-organisation 14-day Growth trial, for organisations that have never had a paid plan */
export async function startTrial(prisma: PrismaClient, organizationId: string) {
  return prisma.$transaction(async (tx) => {
    const [org, paid, product] = await Promise.all([
      tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { trialUsedAt: true } }),
      tx.orgPlanPeriod.count({ where: { organizationId, isTrial: false } }),
      tx.adProduct.findUniqueOrThrow({ where: { code: TRIAL_PLAN_CODE } }),
    ]);
    if (org.trialUsedAt || paid) throw new SubscriptionError("The free trial is for organisations that haven't had a plan yet");
    const claimed = await tx.organization.updateMany({ where: { id: organizationId, trialUsedAt: null }, data: { trialUsedAt: new Date() } });
    if (!claimed.count) throw new SubscriptionError("The free trial has already been used");
    const startsAt = new Date();
    return tx.orgPlanPeriod.create({
      data: { organizationId, productId: product.id, isTrial: true, startsAt, endsAt: new Date(startsAt.getTime() + TRIAL_DAYS * DAY_MS) },
    });
  });
}
