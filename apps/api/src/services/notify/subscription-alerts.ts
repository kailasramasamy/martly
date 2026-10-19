import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { sendNotification } from "../notification.js";
import { alertOnce } from "./once.js";
import { formatINR, formatISTDate, plural } from "./copy.js";
import { notifyStaff } from "./staff.js";

const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "daily",
  ALTERNATE_DAYS: "alternate-day",
  SPECIFIC_DAYS: "scheduled",
  WEEKLY: "weekly",
  BIWEEKLY: "fortnightly",
  MONTHLY: "monthly",
};

const NAMES_SHOWN = 3;

type Ctx = { fcm: Messaging | null; prisma: PrismaClient };

const send = (ctx: Ctx, userId: string, title: string, body: string, data: Record<string, string>) =>
  sendNotification(ctx.fcm, ctx.prisma, { userId, type: "SUBSCRIPTION", title, body, data });

export const frequencyLabel = (frequency: string) => FREQUENCY_LABEL[frequency] ?? "recurring";

export const notifySubscriptionCreated = (ctx: Ctx, userId: string, subscriptionId: string, frequency: string, firstDelivery: Date) =>
  send(ctx, userId, "Subscription created", `Your ${frequencyLabel(frequency)} subscription is set up. First delivery on ${formatISTDate(firstDelivery)}.`, { screen: "subscription", subscriptionId });

export const notifySubscriptionCancelled = (ctx: Ctx, userId: string, subscriptionId: string) =>
  send(ctx, userId, "Subscription cancelled", "Your subscription has been cancelled. You can create a new one anytime.", { screen: "subscription", subscriptionId });

export const notifySkippedForStock = (ctx: Ctx, userId: string, subscriptionId: string, nextDelivery: Date) =>
  send(ctx, userId, "Subscription order skipped", `Some items are out of stock, so we skipped this delivery. We'll try again on ${formatISTDate(nextDelivery)}.`, { screen: "subscription", subscriptionId });

export const notifySkippedForWallet = (ctx: Ctx, userId: string, subscriptionId: string, nextDelivery: Date) =>
  send(ctx, userId, "Subscription skipped: low balance", `Your wallet couldn't cover this order. Top up before ${formatISTDate(nextDelivery)} to keep it going.`, { screen: "wallet", subscriptionId });

export const notifyOrderPlaced = (ctx: Ctx, userId: string, subscriptionId: string, orderId: string, frequency: string, total: number) =>
  send(ctx, userId, "Subscription order placed", `Your ${frequencyLabel(frequency)} order of ${formatINR(total)} has been placed.`, { screen: "order", orderId, subscriptionId });

export const notifyPartialOrderPlaced = (ctx: Ctx, userId: string, subscriptionId: string, orderId: string, total: number, skipped: string[]) =>
  send(ctx, userId, "Partial subscription order", `Low wallet balance: we placed ${formatINR(total)} of your order${skipped.length ? ` without ${skipped.join(", ")}` : ""}. Top up to get the full basket.`, { screen: "order", orderId, subscriptionId });

export async function notifyOrderFailed(ctx: Ctx, userId: string, subscriptionId: string, dateKey: string) {
  if (!(await alertOnce(ctx.prisma, `subfail:${subscriptionId}:${dateKey}`))) return;
  await send(ctx, userId, "We couldn't place today's subscription order", "Something went wrong on our side. The store has been informed.", { screen: "subscription", subscriptionId });
}

export interface StoreBatch { placed: number; skippedForStock: number; outOfStockNames: Set<string> }

/** One staff heads-up per store per day: how many orders tomorrow's basket produced and what stock held back */
export async function notifyStoreBasketSummary(ctx: Ctx, storeId: string, dateKey: string, batch: StoreBatch) {
  if (batch.placed + batch.skippedForStock === 0) return;
  if (!(await alertOnce(ctx.prisma, `subsum:${storeId}:${dateKey}`))) return;
  const names = [...batch.outOfStockNames];
  const listed = names.slice(0, NAMES_SHOWN).join(", ") + (names.length > NAMES_SHOWN ? ` and ${names.length - NAMES_SHOWN} more` : "");
  const skipped = batch.skippedForStock > 0 ? `${batch.skippedForStock} skipped: out of stock${listed ? ` (${listed})` : ""}` : "";
  await notifyStaff(ctx.fcm, ctx.prisma, storeId, { permissions: ["ORDERS_PROCESS"] }, {
    type: "STAFF_ORDER",
    title: `Tomorrow's basket · ${plural(batch.placed, "subscription order")} placed`,
    body: skipped || "Ready to pack for tomorrow's delivery window.",
    data: { screen: "manage-orders" },
  });
}
