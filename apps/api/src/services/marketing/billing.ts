import type { Messaging } from "firebase-admin/messaging";
import type { AdOrder, AdProduct, Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { createRazorpayOrder, getRazorpayKeyId, refundRazorpayPayment } from "../payment.js";
import { notifyCampaignInReview } from "../notify/marketing-alerts.js";
import { getMarketingConfig, nextInvoiceNumber, quote } from "./config.js";
import { spendableBalance } from "../ledger/balance.js";
import { lockOrganization, postEntries } from "../ledger/post.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BillingSnapshot {
  name: string;
  gstin: string | null;
  address: string | null;
  state: string | null;
}

export interface Buyer {
  organizationId?: string;
  brandId?: string;
  billing: BillingSnapshot;
  createdById: string;
}

export class BillingError extends Error {
  name = "BillingError";
  statusCode = 400;
}

/**
 * Records the order at today's price and, for online payment, opens a Razorpay order for its total; the amount
 * never comes from the client. Offline orders (bank transfer to Martly) are settled later with fulfilAdOrder.
 */
export async function createAdOrder(prisma: PrismaClient, product: AdProduct, quantity: number, buyer: Buyer, online = true) {
  if (!product.isActive) throw new BillingError("This package is no longer on sale");
  if (Number(product.price) <= 0) throw new BillingError("This package is free; nothing to pay");
  const config = await getMarketingConfig(prisma);
  const amounts = quote(Number(product.price), quantity, config.gstPercent, buyer.billing.state === config.sellerState);
  const order = await prisma.adOrder.create({
    data: {
      organizationId: buyer.organizationId, brandId: buyer.brandId, productId: product.id, quantity,
      ...amounts, billing: { ...buyer.billing }, createdById: buyer.createdById,
    },
  });
  if (!online) return { order, checkout: null };
  const razorpay = await createRazorpayOrder(Math.round(amounts.total * 100), `ad_${order.id.slice(0, 8)}`, undefined, {
    adOrderId: order.id, product: product.code,
  });
  await prisma.adOrder.update({ where: { id: order.id }, data: { razorpayOrderId: razorpay.id } });
  return {
    order: { ...order, razorpayOrderId: razorpay.id },
    checkout: { orderId: razorpay.id, amount: Number(razorpay.amount), currency: razorpay.currency, keyId: getRazorpayKeyId() },
  };
}

/**
 * Marks the order paid and hands over what was bought. Both the app's verify call and the Razorpay webhook land
 * here, so the PENDING → PAID claim makes the second arrival a no-op.
 */
export async function fulfilAdOrder(
  prisma: PrismaClient, adOrderId: string,
  payment: { paymentId?: string; offlineReference?: string; fromBalanceBy?: string }, fcm: Messaging | null = null,
) {
  const { order: paid, claimed } = await prisma.$transaction(async (tx) => {
    const config = await getMarketingConfig(tx);
    const claimed = await tx.adOrder.updateMany({
      where: { id: adOrderId, status: "PENDING" },
      data: {
        status: "PAID", paidAt: new Date(), razorpayPaymentId: payment.paymentId,
        offlineReference: payment.fromBalanceBy ? "Paid from Martly balance" : payment.offlineReference,
      },
    });
    const order = await tx.adOrder.findUniqueOrThrow({ where: { id: adOrderId }, include: { product: true } });
    if (!claimed.count) return { order, claimed: false };
    if (payment.fromBalanceBy) await chargeBalance(tx, order, payment.fromBalanceBy);
    const number = await nextInvoiceNumber(tx, config.invoicePrefix);
    await tx.adOrder.update({ where: { id: adOrderId }, data: { number } });
    await deliver(tx, order, order.product);
    return { order: { ...order, status: "PAID" as const, number }, claimed: true };
  });
  // The payment is already recorded; a failed alert must not fail it
  if (claimed) void announceCampaignInReview(prisma, fcm, adOrderId).catch((err: unknown) => console.error("Brand campaign review alert failed", err));
  return paid;
}

/** Pays an organization's order from what Martly owes it; fails (rolling back the claim) when the balance falls short */
async function chargeBalance(tx: Prisma.TransactionClient, order: AdOrder & { product: AdProduct }, userId: string) {
  if (!order.organizationId) throw new BillingError("Only organizations can pay from their balance");
  await lockOrganization(tx, order.organizationId);
  if ((await spendableBalance(tx, order.organizationId)) < Number(order.total)) throw new BillingError("Your available balance doesn't cover this");
  await postEntries(tx, [{
    organizationId: order.organizationId, type: "PLAN_FEE", amount: -Number(order.total), sourceType: "AD_ORDER", sourceId: order.id,
    memo: `Paid from balance · ${order.product.name}`, createdBy: userId,
  }]);
}

/** A paid brand package waits for Martly's review, so Martly's team is told */
async function announceCampaignInReview(prisma: PrismaClient, fcm: Messaging | null, adOrderId: string) {
  const campaign = await prisma.brandCampaign.findFirst({ where: { adOrderId, status: "IN_REVIEW" }, select: { brandId: true, title: true } });
  if (campaign) await notifyCampaignInReview(fcm, prisma, campaign);
}

async function deliver(tx: Prisma.TransactionClient, order: AdOrder, product: AdProduct) {
  if (product.kind === "STORE_PLAN" && order.organizationId) return grantPlan(tx, order, product, order.organizationId);
  if (product.kind === "PROMOTION_TOPUP" && order.organizationId) {
    await tx.promotionCreditEntry.create({
      data: { organizationId: order.organizationId, delta: product.promotionCredits * order.quantity, reason: "TOPUP", adOrderId: order.id },
    });
    return;
  }
  if (product.kind === "AI_IMAGE_PACK" && order.organizationId) {
    await tx.aiImageCreditEntry.create({
      data: { organizationId: order.organizationId, delta: product.aiImageCredits * order.quantity, reason: "TOPUP", adOrderId: order.id },
    });
    return;
  }
  // Brand packages: a paid campaign waits for Martly's review before it can go live
  await tx.brandCampaign.updateMany({ where: { adOrderId: order.id, status: "PENDING_PAYMENT" }, data: { status: "IN_REVIEW" } });
}

const YEAR_DAYS = 365;
type Interval = AdOrder["billingInterval"];

/** Days a plan order covers: a year for annual billing, else the plan's month(s) */
export function planDays(order: { billingInterval: Interval; quantity: number }, product: Pick<AdProduct, "durationDays">) {
  return (order.billingInterval === "YEARLY" ? YEAR_DAYS : product.durationDays) * order.quantity;
}

/** A plan's list price per day for a billing interval; it decides whether a change is an upgrade */
export function listDailyRate(product: Pick<AdProduct, "price" | "yearlyPrice" | "durationDays">, interval: Interval) {
  return interval === "YEARLY" && product.yearlyPrice ? Number(product.yearlyPrice) / YEAR_DAYS : Number(product.price) / product.durationDays;
}

type RunningPeriod = { isTrial: boolean; product: AdProduct; adOrder: AdOrder | null };

/** What is left of a running period is worth what was paid for it per day; a free trial is worth nothing */
function paidDailyRate(period: RunningPeriod) {
  if (period.isTrial) return 0;
  if (!period.adOrder) return Number(period.product.price) / period.product.durationDays;
  return Number(period.adOrder.subtotal) / planDays(period.adOrder, period.product);
}

export const intervalOf = (period: Pick<RunningPeriod, "adOrder">): Interval => period.adOrder?.billingInterval ?? "MONTHLY";

/**
 * A plan bought while one is running queues after it, except an upgrade (a higher price per day): that starts now,
 * and the unused value of the running plan carries over as extra days at the new rate (a free trial carries
 * nothing). Months already queued move back accordingly.
 */
export async function grantPlan(tx: Prisma.TransactionClient, order: AdOrder, product: AdProduct, organizationId: string) {
  const now = new Date();
  const days = planDays(order, product);
  const length = days * DAY_MS;
  const current = await tx.orgPlanPeriod.findFirst({
    where: { organizationId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
    include: { product: true, adOrder: true },
  });
  if (current && listDailyRate(product, order.billingInterval) > listDailyRate(current.product, intervalOf(current))) {
    const carry = ((current.endsAt.getTime() - now.getTime()) * paidDailyRate(current)) / (Number(order.subtotal) / days);
    const endsAt = new Date(now.getTime() + length + carry);
    await tx.orgPlanPeriod.update({ where: { id: current.id }, data: { endsAt: now, closedAt: now } });
    // Months already queued started when the old plan would have ended; they now follow the upgrade
    await shiftQueuedPeriods(tx, organizationId, now, endsAt.getTime() - current.endsAt.getTime());
    return tx.orgPlanPeriod.create({ data: { organizationId, productId: product.id, adOrderId: order.id, startsAt: now, endsAt } });
  }
  const last = await tx.orgPlanPeriod.findFirst({ where: { organizationId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" } });
  const startsAt = last?.endsAt ?? now;
  return tx.orgPlanPeriod.create({
    data: { organizationId, productId: product.id, adOrderId: order.id, startsAt, endsAt: new Date(startsAt.getTime() + length) },
  });
}

async function shiftQueuedPeriods(tx: Prisma.TransactionClient, organizationId: string, after: Date, byMs: number) {
  const queued = await tx.orgPlanPeriod.findMany({ where: { organizationId, startsAt: { gt: after } } });
  for (const period of queued) {
    await tx.orgPlanPeriod.update({
      where: { id: period.id },
      data: { startsAt: new Date(period.startsAt.getTime() + byMs), endsAt: new Date(period.endsAt.getTime() + byMs) },
    });
  }
}

/** Cancels an unpaid order, or refunds a paid one (online payments through Razorpay, transfers by hand) */
export async function refundAdOrder(prisma: PrismaClient, adOrderId: string) {
  const order = await prisma.adOrder.findUniqueOrThrow({ where: { id: adOrderId } });
  if (order.status === "PENDING") return prisma.adOrder.update({ where: { id: adOrderId }, data: { status: "CANCELLED" } });
  if (order.status !== "PAID") return order;
  if (order.razorpayPaymentId) await refundRazorpayPayment(order.razorpayPaymentId);
  return prisma.$transaction(async (tx) => {
    // An order paid from the balance is refunded back to it
    const fee = await tx.ledgerEntry.findUnique({ where: { type_sourceId: { type: "PLAN_FEE", sourceId: order.id } } });
    if (fee) {
      await postEntries(tx, [{
        organizationId: fee.organizationId, type: "REVERSAL", amount: -Number(fee.amount), sourceType: "LEDGER_ENTRY", sourceId: fee.id,
        memo: `Refunded · reverses ${fee.memo}`,
      }]);
    }
    return tx.adOrder.update({ where: { id: adOrderId }, data: { status: "REFUNDED" } });
  });
}
