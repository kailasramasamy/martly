import type { FastifyInstance } from "fastify";
import type { Prisma, Store } from "../../../generated/prisma/client.js";
import {
  notifyOrderPlaced, notifyPartialOrderPlaced, notifySkippedForStock, notifySkippedForWallet, type StoreBatch,
} from "../notify/subscription-alerts.js";
import { deliveryFeeTo } from "../delivery/fee.js";
import { deliveryFeeAfterWaivers, memberBenefits } from "../line-pricing.js";
import { conflict, lockWalletBalance } from "../order-guards.js";
import { advanceNextDeliveryDate } from "../../utils/subscription-dates.js";
import { buildBasket, catchUpDate, fitToWallet, type BasketLine, type DeliveryDay, type DueSubscription } from "./basket.js";

type Db = Prisma.TransactionClient | FastifyInstance["prisma"];

/**
 * Moves the subscription's next delivery date on from the date it was read with. Only one run can do that for a
 * given date, so a second scheduler instance (or an overlapping tick) finds 0 rows and leaves the day alone.
 */
export async function claimDate(db: Db, sub: DueSubscription, next: Date): Promise<boolean> {
  const { count } = await db.subscription.updateMany({
    where: { id: sub.id, nextDeliveryDate: sub.nextDeliveryDate },
    data: { nextDeliveryDate: next },
  });
  return count === 1;
}

export const nextDate = (sub: DueSubscription) => advanceNextDeliveryDate(sub.nextDeliveryDate, sub.frequency, sub.selectedDays);

async function hasShortStock(app: FastifyInstance, lines: BasketLine[]) {
  const listings = await app.prisma.storeProduct.findMany({
    where: { id: { in: lines.map((l) => l.storeProductId) } },
    select: { id: true, stock: true, reservedStock: true },
  });
  const short = lines.filter((l) => {
    const sp = listings.find((x) => x.id === l.storeProductId);
    return !sp || sp.stock - sp.reservedStock < l.quantity;
  });
  return short.map((l) => l.name);
}

/** What the order charges: the basket with its delivery fee, cut down to what the wallet holds when it runs short */
async function charge(app: FastifyInstance, sub: DueSubscription, store: Store, lines: BasketLine[], benefits: { isMember: boolean; freeDelivery: boolean }) {
  const point = sub.deliveryLat != null && sub.deliveryLng != null ? { lat: sub.deliveryLat, lng: sub.deliveryLng } : null;
  const delivery = await deliveryFeeTo(app.prisma, store.id, store, point);
  // A subscriber the store no longer reaches still gets the delivery they signed up for
  const baseFee = delivery.serviceable ? delivery.fee : 0;
  const feeFor = (items: BasketLine[]) =>
    deliveryFeeAfterWaivers(baseFee, items.reduce((s, l) => s + l.totalPrice, 0), store.freeDeliveryThreshold, benefits.freeDelivery);
  const user = await app.prisma.user.findUniqueOrThrow({ where: { id: sub.userId }, select: { walletBalance: true } });
  const balance = Number(user.walletBalance);
  const total = (items: BasketLine[]) => items.reduce((s, l) => s + l.totalPrice, 0) + feeFor(items);
  if (total(lines) <= balance) return { lines, fee: feeFor(lines), short: [] as string[] };
  // Fit against the fee without the threshold waiver: a smaller basket may lose it
  const { kept, short } = fitToWallet(lines, benefits.freeDelivery ? 0 : baseFee, balance, benefits.isMember);
  return { lines: kept, fee: feeFor(kept), short };
}

function estimatedDelivery(store: Store, day: DeliveryDay) {
  if (!store.subscriptionWindowStart) return undefined;
  const [h, m] = store.subscriptionWindowStart.split(":").map(Number);
  const at = new Date(day.start);
  // Window times are IST; stored in UTC
  at.setUTCHours(h - 5, m - 30, 0, 0);
  return at;
}

async function reserve(tx: Prisma.TransactionClient, lines: BasketLine[]) {
  for (const l of lines) {
    const reserved = await tx.$executeRaw`
      UPDATE store_products SET reserved_stock = reserved_stock + ${l.quantity}
      WHERE id = ${l.storeProductId} AND stock - reserved_stock >= ${l.quantity}`;
    if (reserved === 0) throw new Error(`Stock reservation failed for ${l.name}`);
  }
}

/** Claims the day, reserves stock, creates the paid order and debits the wallet, all or nothing */
async function createOrder(app: FastifyInstance, sub: DueSubscription, store: Store, day: DeliveryDay, bill: { lines: BasketLine[]; fee: number; partial: boolean }) {
  const total = bill.lines.reduce((s, l) => s + l.totalPrice, 0) + bill.fee;
  const note = bill.partial ? "Auto-placed subscription order (partial — low wallet balance), paid via wallet" : "Auto-placed subscription order, paid via wallet";
  return app.prisma.$transaction(async (tx) => {
    if (!(await claimDate(tx, sub, nextDate(sub)))) throw conflict("Subscription day already handled");
    await reserve(tx, bill.lines);
    const order = await tx.order.create({
      data: {
        userId: sub.userId, storeId: store.id, isSubscriptionOrder: true, subscriptionId: sub.id,
        status: "CONFIRMED", paymentStatus: "PAID", paymentMethod: "ONLINE", fulfillmentType: "DELIVERY",
        totalAmount: total, deliveryFee: bill.fee, walletAmountUsed: total,
        deliveryAddress: sub.deliveryAddress, deliveryLat: sub.deliveryLat ?? undefined, deliveryLng: sub.deliveryLng ?? undefined,
        deliveryPincode: sub.deliveryPincode ?? undefined, scheduledDate: day.start,
        slotStartTime: store.subscriptionWindowStart, slotEndTime: store.subscriptionWindowEnd, estimatedDeliveryAt: estimatedDelivery(store, day),
        items: {
          create: bill.lines.map((l) => ({
            storeProductId: l.storeProductId, productId: l.productId, variantId: l.variantId, quantity: l.quantity,
            unitPrice: l.unitPrice, totalPrice: l.totalPrice, freeQuantity: l.freeQuantity,
            originalPrice: l.pricing.discountActive ? l.pricing.originalPrice : undefined,
            discountType: l.pricing.discountType ?? undefined, discountValue: l.pricing.discountValue ?? undefined,
          })) as Prisma.OrderItemUncheckedCreateWithoutOrderInput[],
        },
        statusLogs: { create: [{ status: "PENDING" }, { status: "CONFIRMED", note }] },
      },
    });
    if (await lockWalletBalance(tx, sub.userId) < total) throw new Error(`Insufficient wallet balance for ₹${total}`);
    const user = await tx.user.update({ where: { id: sub.userId }, data: { walletBalance: { decrement: total } } });
    await tx.walletTransaction.create({
      data: {
        userId: sub.userId, orderId: order.id, type: "DEBIT", amount: total, reason: "SUBSCRIPTION",
        organizationId: store.organizationId, storeId: store.id, balanceAfter: Number(user.walletBalance),
        description: `Subscription order #${order.id.slice(0, 8)}${bill.partial ? " (partial)" : ""}`,
      },
    });
    return { order, total };
  });
}

type Outcome = "placed" | "skipped" | "stock" | "none";

/**
 * Handles one subscription due for `day`: a stale date is first stepped forward (a missed run or a pause no longer
 * strands it), then the day is skipped, left empty, short of stock, short of wallet, or ordered. Every outcome moves
 * the date on through claimDate, so each day is handled exactly once.
 */
export async function runSubscription(app: FastifyInstance, sub: DueSubscription, store: Store, day: DeliveryDay, batch: StoreBatch): Promise<Outcome> {
  const ctx = { fcm: app.fcm, prisma: app.prisma };
  if (sub.nextDeliveryDate < day.start) {
    const caughtUp = catchUpDate(sub.nextDeliveryDate, sub.frequency, sub.selectedDays, day.start);
    if (!(await claimDate(app.prisma, sub, caughtUp)) || caughtUp >= day.end) return "none";
    sub = { ...sub, nextDeliveryDate: caughtUp };
  }
  const skip = await app.prisma.subscriptionSkip.findUnique({ where: { subscriptionId_date: { subscriptionId: sub.id, date: day.start } } });
  if (skip) {
    await claimDate(app.prisma, sub, nextDate(sub));
    return "skipped";
  }

  const benefits = await memberBenefits(app.prisma, sub.userId, store.organizationId);
  const basket = await buildBasket(app.prisma, sub, day, benefits.isMember);
  if (basket.lines.length === 0) {
    await claimDate(app.prisma, sub, nextDate(sub));
    return "none";
  }

  const outOfStock = await hasShortStock(app, basket.lines);
  if (outOfStock.length > 0) {
    if (await claimDate(app.prisma, sub, nextDate(sub))) {
      await notifySkippedForStock(ctx, sub.userId, sub.id, nextDate(sub));
      batch.skippedForStock++;
      outOfStock.forEach((n) => batch.outOfStockNames.add(n));
    }
    return "stock";
  }

  const bill = await charge(app, sub, store, basket.lines, benefits);
  if (bill.lines.length === 0) {
    if (await claimDate(app.prisma, sub, nextDate(sub))) await notifySkippedForWallet(ctx, sub.userId, sub.id, nextDate(sub));
    return "skipped";
  }
  const partial = bill.short.length > 0;
  const { order, total } = await createOrder(app, sub, store, day, { lines: bill.lines, fee: bill.fee, partial });
  await clearDayChanges(app, sub, day, basket);
  batch.placed++;
  if (partial) await notifyPartialOrderPlaced(ctx, sub.userId, sub.id, order.id, total, bill.short);
  else await notifyOrderPlaced(ctx, sub.userId, sub.id, order.id, sub.frequency, total);
  return "placed";
}

/** The day's add-ons and quantity changes are used up once its order is placed */
async function clearDayChanges(app: FastifyInstance, sub: DueSubscription, day: DeliveryDay, basket: { hadAddOns: boolean; hadOverrides: boolean }) {
  const range = { gte: day.start, lt: day.end };
  if (basket.hadAddOns) await app.prisma.basketAddOn.deleteMany({ where: { userId: sub.userId, storeId: sub.storeId, deliveryDate: range } });
  if (basket.hadOverrides) await app.prisma.subscriptionItemOverride.deleteMany({ where: { subscriptionId: sub.id, deliveryDate: range } });
}
