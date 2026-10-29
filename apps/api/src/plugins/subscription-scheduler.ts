import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Prisma } from "../../generated/prisma/index.js";
import {
  notifyOrderFailed, notifyOrderPlaced, notifyPartialOrderPlaced, notifySkippedForStock, notifySkippedForWallet,
  notifyStoreBasketSummary, type StoreBatch,
} from "../services/notify/subscription-alerts.js";
import { calculateEffectivePrice } from "../services/pricing.js";
import { advanceNextDeliveryDate, isDeliveryDay } from "../utils/subscription-dates.js";
import { deliveryFeeTo } from "../services/delivery/fee.js";
import { tomorrowIST, endOfDayUTC, currentISTTime } from "../utils/timezone.js";
import { lockWalletBalance } from "../services/order-guards.js";

const INTERVAL_MS = 60_000; // 1 minute
const STARTUP_DELAY_MS = 30_000; // 30 seconds after startup

async function subscriptionSchedulerPlugin(app: FastifyInstance) {
  async function processSubscriptions() {
    try {
      const now = new Date();
      const currentTime = currentISTTime();

      // Find stores with subscriptions enabled and matching cutoff time (IST)
      const stores = await app.prisma.store.findMany({
        where: {
          subscriptionEnabled: true,
          subscriptionCutoffTime: currentTime,
        },
      });

      if (stores.length === 0) return;

      app.log.info(
        `Subscription scheduler: processing ${stores.length} store(s) at ${currentTime} IST`,
      );

      // Tomorrow date range (IST-aware, stored as UTC midnight)
      const tomorrowStart = tomorrowIST();
      const tomorrowEnd = endOfDayUTC(tomorrowStart);

      for (const store of stores) {
        try {
          const subscriptions = await app.prisma.subscription.findMany({
            where: {
              storeId: store.id,
              status: "ACTIVE",
              nextDeliveryDate: { gte: tomorrowStart, lt: tomorrowEnd },
              OR: [{ pausedUntil: null }, { pausedUntil: { lt: now } }],
            },
            include: {
              items: {
                include: {
                  storeProduct: {
                    include: { product: true, variant: true },
                  },
                },
              },
              user: { select: { id: true, walletBalance: true } },
            },
          });

          if (subscriptions.length === 0) continue;

          app.log.info(
            `Store ${store.name}: processing ${subscriptions.length} subscription(s)`,
          );

          const batch: StoreBatch = { placed: 0, skippedForStock: 0, outOfStockNames: new Set() };
          const ctx = { fcm: app.fcm, prisma: app.prisma };
          const dateKey = tomorrowStart.toISOString().slice(0, 10);

          for (const sub of subscriptions) {
            try {
              // Check if tomorrow has a skip
              const skip = await app.prisma.subscriptionSkip.findUnique({
                where: {
                  subscriptionId_date: {
                    subscriptionId: sub.id,
                    date: tomorrowStart,
                  },
                },
              });

              if (skip) {
                // Advance next delivery date and continue
                const nextDate = advanceNextDeliveryDate(
                  sub.nextDeliveryDate,
                  sub.frequency,
                  sub.selectedDays,
                );
                await app.prisma.subscription.update({
                  where: { id: sub.id },
                  data: { nextDeliveryDate: nextDate },
                });
                app.log.info(
                  `Subscription ${sub.id}: skipped (user requested), next: ${nextDate.toISOString()}`,
                );
                continue;
              }

              // Fetch quantity overrides for this subscription + tomorrow
              const itemOverrides = await app.prisma.subscriptionItemOverride.findMany({
                where: {
                  subscriptionId: sub.id,
                  deliveryDate: { gte: tomorrowStart, lt: tomorrowEnd },
                },
              });
              const overrideMap = new Map<string, number>();
              for (const o of itemOverrides) {
                overrideMap.set(o.storeProductId, o.quantity);
              }

              // Gather subscription items
              const orderItems: Array<{
                storeProductId: string;
                productId: string;
                variantId: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
                originalPrice?: number;
                discountType?: string;
                discountValue?: number;
              }> = [];

              // Add subscription base items (applying overrides)
              for (const item of sub.items) {
                const qty = overrideMap.has(item.storeProductId)
                  ? overrideMap.get(item.storeProductId)!
                  : item.quantity;

                // Skip items with override quantity = 0
                if (qty === 0) continue;

                const sp = item.storeProduct;
                const pricing = calculateEffectivePrice(
                  sp.price as unknown as number,
                  {
                    discountType: sp.variant.discountType,
                    discountValue: sp.variant.discountValue,
                    discountStart: sp.variant.discountStart,
                    discountEnd: sp.variant.discountEnd,
                  },
                  {
                    discountType: sp.discountType,
                    discountValue: sp.discountValue,
                    discountStart: sp.discountStart,
                    discountEnd: sp.discountEnd,
                  },
                  sp.memberPrice,
                );
                const unitPrice = pricing.effectivePrice;
                const totalPrice = unitPrice * qty;
                orderItems.push({
                  storeProductId: sp.id,
                  productId: sp.productId,
                  variantId: sp.variantId,
                  quantity: qty,
                  unitPrice,
                  totalPrice,
                  originalPrice: pricing.discountActive
                    ? pricing.originalPrice
                    : undefined,
                  discountType: pricing.discountType ?? undefined,
                  discountValue: pricing.discountValue ?? undefined,
                });
              }

              // Fetch BasketAddOn items for this user/store/tomorrow
              const addOns = await app.prisma.basketAddOn.findMany({
                where: {
                  userId: sub.userId,
                  storeId: store.id,
                  deliveryDate: { gte: tomorrowStart, lt: tomorrowEnd },
                },
                include: {
                  storeProduct: {
                    include: { product: true, variant: true },
                  },
                },
              });

              for (const addOn of addOns) {
                const sp = addOn.storeProduct;
                // Check if this storeProduct already exists in order items
                const existing = orderItems.find(
                  (oi) => oi.storeProductId === sp.id,
                );
                const pricing = calculateEffectivePrice(
                  sp.price as unknown as number,
                  {
                    discountType: sp.variant.discountType,
                    discountValue: sp.variant.discountValue,
                    discountStart: sp.variant.discountStart,
                    discountEnd: sp.variant.discountEnd,
                  },
                  {
                    discountType: sp.discountType,
                    discountValue: sp.discountValue,
                    discountStart: sp.discountStart,
                    discountEnd: sp.discountEnd,
                  },
                  sp.memberPrice,
                );
                const unitPrice = pricing.effectivePrice;

                if (existing) {
                  existing.quantity += addOn.quantity;
                  existing.totalPrice = existing.unitPrice * existing.quantity;
                } else {
                  orderItems.push({
                    storeProductId: sp.id,
                    productId: sp.productId,
                    variantId: sp.variantId,
                    quantity: addOn.quantity,
                    unitPrice,
                    totalPrice: unitPrice * addOn.quantity,
                    originalPrice: pricing.discountActive
                      ? pricing.originalPrice
                      : undefined,
                    discountType: pricing.discountType ?? undefined,
                    discountValue: pricing.discountValue ?? undefined,
                  });
                }
              }

              if (orderItems.length === 0) {
                // Nothing to order — advance and continue
                const nextDate = advanceNextDeliveryDate(
                  sub.nextDeliveryDate,
                  sub.frequency,
                  sub.selectedDays,
                );
                await app.prisma.subscription.update({
                  where: { id: sub.id },
                  data: { nextDeliveryDate: nextDate },
                });
                continue;
              }

              // Validate stock availability
              const shortNames: string[] = [];
              for (const item of orderItems) {
                const sp = await app.prisma.storeProduct.findUnique({
                  where: { id: item.storeProductId },
                  select: { stock: true, reservedStock: true, product: { select: { name: true } } },
                });
                if (!sp || sp.stock - sp.reservedStock < item.quantity) {
                  shortNames.push(sp?.product.name ?? "item");
                }
              }

              if (shortNames.length > 0) {
                const nextDate = advanceNextDeliveryDate(
                  sub.nextDeliveryDate,
                  sub.frequency,
                  sub.selectedDays,
                );
                await notifySkippedForStock(ctx, sub.userId, sub.id, nextDate);
                batch.skippedForStock++;
                shortNames.forEach((n) => batch.outOfStockNames.add(n));
                await app.prisma.subscription.update({
                  where: { id: sub.id },
                  data: { nextDeliveryDate: nextDate },
                });
                app.log.info(
                  `Subscription ${sub.id}: skipped (insufficient stock)`,
                );
                continue;
              }

              // Calculate totals
              const point = sub.deliveryLat != null && sub.deliveryLng != null ? { lat: sub.deliveryLat, lng: sub.deliveryLng } : null;
              const delivery = await deliveryFeeTo(app.prisma, store.id, store, point);
              // A subscriber the store no longer reaches still gets the delivery they signed up for
              const deliveryFee = delivery.serviceable ? delivery.fee : 0;
              let finalItems = orderItems;
              let finalItemsTotal = orderItems.reduce(
                (sum, i) => sum + i.totalPrice,
                0,
              );
              let finalTotal = finalItemsTotal + deliveryFee;
              let isPartial = false;
              let skippedNames: string[] = [];

              // Check wallet balance
              const walletBalance = Number(sub.user.walletBalance);

              if (walletBalance < finalTotal) {
                // Partial fulfillment: subscription items first, then add-ons
                // Items are already in priority order (subscription items pushed first, add-ons after)
                const partialItems: typeof orderItems = [];
                let runningTotal = deliveryFee;
                skippedNames = [];

                for (const item of orderItems) {
                  if (runningTotal + item.totalPrice <= walletBalance) {
                    partialItems.push(item);
                    runningTotal += item.totalPrice;
                  } else {
                    // Try to fit a reduced quantity
                    const affordableQty = Math.floor((walletBalance - runningTotal) / item.unitPrice);
                    if (affordableQty > 0) {
                      partialItems.push({
                        ...item,
                        quantity: affordableQty,
                        totalPrice: item.unitPrice * affordableQty,
                      });
                      runningTotal += item.unitPrice * affordableQty;
                    }
                    // Look up product name for skipped notification
                    const sp = await app.prisma.storeProduct.findUnique({
                      where: { id: item.storeProductId },
                      select: { product: { select: { name: true } } },
                    });
                    skippedNames.push(sp?.product.name ?? "item");
                  }
                }

                if (partialItems.length === 0) {
                  // Can't afford delivery + any item — skip entirely
                  const nextDate = advanceNextDeliveryDate(
                    sub.nextDeliveryDate,
                    sub.frequency,
                    sub.selectedDays,
                  );
                  await notifySkippedForWallet(ctx, sub.userId, sub.id, nextDate);
                  await app.prisma.subscription.update({
                    where: { id: sub.id },
                    data: { nextDeliveryDate: nextDate },
                  });
                  app.log.info(
                    `Subscription ${sub.id}: skipped (insufficient wallet balance: \u20B9${walletBalance} < \u20B9${finalTotal})`,
                  );
                  continue;
                }

                finalItems = partialItems;
                finalItemsTotal = partialItems.reduce((s, i) => s + i.totalPrice, 0);
                finalTotal = finalItemsTotal + deliveryFee;
                isPartial = true;
              }

              // Compute delivery window for subscription orders
              // Window times are in IST — convert to UTC for storage
              let estimatedDeliveryAt: Date | undefined;
              if (store.subscriptionWindowStart) {
                const [h, m] = store.subscriptionWindowStart.split(":").map(Number);
                estimatedDeliveryAt = new Date(tomorrowStart);
                // Set IST time, then subtract IST offset to get UTC
                estimatedDeliveryAt.setUTCHours(h - 5, m - 30, 0, 0);
              }

              // Create order in a transaction
              const order = await app.prisma.$transaction(async (tx) => {
                // Reserve stock atomically
                for (const item of finalItems) {
                  const res = await tx.$executeRaw`
                    UPDATE store_products
                    SET reserved_stock = reserved_stock + ${item.quantity}
                    WHERE id = ${item.storeProductId}
                      AND stock - reserved_stock >= ${item.quantity}
                  `;
                  if (res === 0) {
                    throw new Error(
                      `Stock reservation failed for ${item.storeProductId}`,
                    );
                  }
                }

                // Create order
                const newOrder = await tx.order.create({
                  data: {
                    userId: sub.userId,
                    storeId: store.id,
                    isSubscriptionOrder: true,
                    subscriptionId: sub.id,
                    status: "CONFIRMED",
                    paymentStatus: "PAID",
                    paymentMethod: "ONLINE",
                    totalAmount: finalTotal,
                    deliveryFee,
                    deliveryAddress: sub.deliveryAddress,
                    deliveryLat: sub.deliveryLat ?? undefined,
                    deliveryLng: sub.deliveryLng ?? undefined,
                    deliveryPincode: sub.deliveryPincode ?? undefined,
                    fulfillmentType: "DELIVERY",
                    scheduledDate: tomorrowStart,
                    slotStartTime: store.subscriptionWindowStart,
                    slotEndTime: store.subscriptionWindowEnd,
                    estimatedDeliveryAt,
                    walletAmountUsed: finalTotal,
                    items: {
                      create: finalItems.map((item) => ({
                        storeProductId: item.storeProductId,
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        originalPrice: item.originalPrice,
                        discountType: item.discountType,
                        discountValue: item.discountValue,
                      })) as Prisma.OrderItemUncheckedCreateWithoutOrderInput[],
                    },
                    statusLogs: {
                      create: [
                        { status: "PENDING" },
                        {
                          status: "CONFIRMED",
                          note: isPartial
                            ? "Auto-placed subscription order (partial — low wallet balance), paid via wallet"
                            : "Auto-placed subscription order, paid via wallet",
                        },
                      ],
                    },
                  },
                });

                // Deduct wallet balance; the balance read for the batch may be stale, so re-check it under a lock
                if (await lockWalletBalance(tx, sub.userId) < finalTotal) {
                  throw new Error(`insufficient wallet balance for \u20B9${finalTotal}`);
                }
                const updatedUser = await tx.user.update({
                  where: { id: sub.userId },
                  data: { walletBalance: { decrement: finalTotal } },
                });
                await tx.walletTransaction.create({
                  data: {
                    userId: sub.userId,
                    orderId: newOrder.id,
                    type: "DEBIT",
                    amount: finalTotal,
                    reason: "SUBSCRIPTION",
                    organizationId: store.organizationId,
                    storeId: store.id,
                    balanceAfter: Number(updatedUser.walletBalance),
                    description: isPartial
                      ? `Subscription order #${newOrder.id.slice(0, 8)} (partial)`
                      : `Subscription order #${newOrder.id.slice(0, 8)}`,
                  },
                });

                return newOrder;
              });

              batch.placed++;
              if (isPartial) {
                await notifyPartialOrderPlaced(ctx, sub.userId, sub.id, order.id, finalTotal, skippedNames);
              } else {
                await notifyOrderPlaced(ctx, sub.userId, sub.id, order.id, sub.frequency, finalTotal);
              }

              // Advance next delivery date
              const nextDate = advanceNextDeliveryDate(
                sub.nextDeliveryDate,
                sub.frequency,
                sub.selectedDays,
              );
              await app.prisma.subscription.update({
                where: { id: sub.id },
                data: { nextDeliveryDate: nextDate },
              });

              // Clean up processed BasketAddOn records
              if (addOns.length > 0) {
                await app.prisma.basketAddOn.deleteMany({
                  where: {
                    userId: sub.userId,
                    storeId: store.id,
                    deliveryDate: { gte: tomorrowStart, lt: tomorrowEnd },
                  },
                });
              }

              // Clean up processed SubscriptionItemOverride records
              if (itemOverrides.length > 0) {
                await app.prisma.subscriptionItemOverride.deleteMany({
                  where: {
                    subscriptionId: sub.id,
                    deliveryDate: { gte: tomorrowStart, lt: tomorrowEnd },
                  },
                });
              }

              app.log.info(
                `Subscription ${sub.id}: order ${order.id} placed${isPartial ? " (partial)" : ""} (\u20B9${finalTotal}), next: ${nextDate.toISOString()}`,
              );
            } catch (err) {
              app.log.error(
                err,
                `Failed to process subscription ${sub.id}`,
              );
              await notifyOrderFailed(ctx, sub.userId, sub.id, dateKey);
            }
          }
          await notifyStoreBasketSummary(ctx, store.id, dateKey, batch);
        } catch (err) {
          app.log.error(
            err,
            `Failed to process subscriptions for store ${store.id}`,
          );
        }
      }
    } catch (err) {
      app.log.error(err, "Subscription scheduler: top-level error");
    }
  }

  let intervalId: ReturnType<typeof setInterval>;

  app.addHook("onReady", () => {
    setTimeout(() => {
      processSubscriptions();
      intervalId = setInterval(processSubscriptions, INTERVAL_MS);
    }, STARTUP_DELAY_MS);
    app.log.info(
      "Subscription scheduler registered (60s interval, 30s startup delay)",
    );
  });

  app.addHook("onClose", () => {
    if (intervalId) clearInterval(intervalId);
  });
}

export default fp(subscriptionSchedulerPlugin, {
  name: "subscription-scheduler",
});
