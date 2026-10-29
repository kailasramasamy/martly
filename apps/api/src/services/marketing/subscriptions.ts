import { Prisma, type AdProduct, type Organization, type PrismaClient } from "../../../generated/prisma/client.js";
import { cancelRazorpaySubscription, createRazorpayPlan, createRazorpaySubscription, getRazorpayKeyId } from "../payment.js";
import { BillingError, grantPlan, intervalOf, listDailyRate } from "./billing.js";
import { getMarketingConfig, nextInvoiceNumber, quote } from "./config.js";

/** Subscriptions that still bill (or will): the one an organisation has at most */
const OPEN = ["CREATED", "ACTIVE", "PENDING", "HALTED"] as const;

class SubscriptionError extends Error {
  name = "SubscriptionError";
  constructor(message: string, public statusCode = 409) {
    super(message);
  }
}

type Interval = "MONTHLY" | "YEARLY";

const priceFor = (product: AdProduct, interval: Interval) => Number(interval === "YEARLY" ? product.yearlyPrice : product.price);

/** The Razorpay plan billing this price (GST included) monthly or yearly, made the first time and again whenever the price changes */
async function razorpayPlanFor(prisma: PrismaClient, product: AdProduct, interval: Interval) {
  const { gstPercent } = await getMarketingConfig(prisma);
  const amount = Math.round(quote(priceFor(product, interval), 1, gstPercent, true).total * 100);
  const yearly = interval === "YEARLY";
  const [planId, planAmount] = yearly ? [product.razorpayYearlyPlanId, product.razorpayYearlyPlanAmount] : [product.razorpayPlanId, product.razorpayPlanAmount];
  if (planId && planAmount === amount) return { planId, amount };
  const created = await createRazorpayPlan(`Martly ${product.name} plan${yearly ? " (annual)" : ""}`, amount, yearly ? "yearly" : "monthly");
  await prisma.adProduct.update({
    where: { id: product.id },
    data: yearly ? { razorpayYearlyPlanId: created, razorpayYearlyPlanAmount: amount } : { razorpayPlanId: created, razorpayPlanAmount: amount },
  });
  return { planId: created, amount };
}

/** When billing for a new plan should start: now for an upgrade (or nothing running), else when the current plan ends */
async function billingStart(prisma: PrismaClient, organizationId: string, product: AdProduct, interval: Interval) {
  const now = new Date();
  const [inForce, last] = await Promise.all([
    prisma.orgPlanPeriod.findFirst({
      where: { organizationId, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: "desc" }, include: { product: true, adOrder: true },
    }),
    prisma.orgPlanPeriod.findFirst({ where: { organizationId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" } }),
  ]);
  const upgrade = !inForce || listDailyRate(product, interval) > listDailyRate(inForce.product, intervalOf(inForce));
  return { upgrade, startAt: upgrade ? undefined : last!.endsAt };
}

/**
 * Starts a plan that renews every month or year. An upgrade (a higher price per day) replaces the running
 * subscription now; anything else sets up its mandate now and is first charged when the current plan (or trial) ends.
 */
export async function startSubscription(prisma: PrismaClient, organizationId: string, product: AdProduct, interval: Interval, createdById: string) {
  if (product.kind !== "STORE_PLAN" || !product.isActive || !(priceFor(product, interval) > 0)) {
    throw new BillingError(interval === "YEARLY" ? "This plan has no annual option" : "Choose a paid plan");
  }
  const current = await prisma.marketingSubscription.findFirst({
    where: { organizationId, status: { in: [...OPEN] }, cancelAtPeriodEnd: false }, include: { product: true },
  });
  if (current?.productId === product.id && current.interval === interval && current.status !== "CREATED") {
    throw new SubscriptionError(`Your ${product.name} plan already renews automatically`);
  }
  const { upgrade, startAt } = await billingStart(prisma, organizationId, product, interval);
  if (current) {
    // An unpaid checkout or an upgrade ends the old subscription now; a downgrade lets the paid month finish
    const now = current.status === "CREATED" || upgrade;
    await cancelRazorpaySubscription(current.razorpaySubscriptionId, !now);
    await prisma.marketingSubscription.update({ where: { id: current.id }, data: now ? { status: "CANCELLED" } : { cancelAtPeriodEnd: true } });
  }
  const { planId, amount } = await razorpayPlanFor(prisma, product, interval);
  const subscription = await createRazorpaySubscription(planId, { organizationId, productId: product.id, interval }, startAt);
  await prisma.marketingSubscription.create({
    data: { organizationId, productId: product.id, interval, razorpaySubscriptionId: subscription.id, startAt: startAt ?? null, createdById },
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
          organizationId: org.id, productId: sub.productId, billingInterval: sub.interval, ...amounts, status: "PAID", paidAt: new Date(), razorpayPaymentId: payment.id,
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
