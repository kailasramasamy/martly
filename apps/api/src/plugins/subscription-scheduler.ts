import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Store } from "../../generated/prisma/index.js";
import { notifyOrderFailed, notifyStoreBasketSummary, type StoreBatch } from "../services/notify/subscription-alerts.js";
import { subscriptionInclude, type DeliveryDay } from "../services/subscriptions/basket.js";
import { claimDate, nextDate, runSubscription } from "../services/subscriptions/place.js";
import { tomorrowIST, endOfDayUTC, currentISTTime } from "../utils/timezone.js";

const INTERVAL_MS = 60_000; // 1 minute
const STARTUP_DELAY_MS = 30_000; // 30 seconds after startup

async function subscriptionSchedulerPlugin(app: FastifyInstance) {
  /** Places tomorrow's orders for one store; a subscription that fails loses only that day, and the customer is told */
  async function processStore(store: Store, day: DeliveryDay) {
    const subscriptions = await app.prisma.subscription.findMany({
      where: {
        storeId: store.id,
        status: "ACTIVE",
        // Anything due by tomorrow, including dates a missed run or a pause left behind
        nextDeliveryDate: { lt: day.end },
        OR: [{ pausedUntil: null }, { pausedUntil: { lt: new Date() } }],
      },
      include: subscriptionInclude,
    });
    if (subscriptions.length === 0) return;
    app.log.info(`Store ${store.name}: processing ${subscriptions.length} subscription(s)`);

    const batch: StoreBatch = { placed: 0, skippedForStock: 0, outOfStockNames: new Set() };
    const ctx = { fcm: app.fcm, prisma: app.prisma };
    const dateKey = day.start.toISOString().slice(0, 10);
    for (const sub of subscriptions) {
      try {
        const outcome = await runSubscription(app, sub, store, day, batch);
        app.log.info(`Subscription ${sub.id}: ${outcome}`);
      } catch (err) {
        // Another instance or tick handled this day first
        if ((err as { statusCode?: number }).statusCode === 409) continue;
        app.log.error(err, `Failed to process subscription ${sub.id}`);
        if (sub.nextDeliveryDate >= day.start && (await claimDate(app.prisma, sub, nextDate(sub)))) {
          await notifyOrderFailed(ctx, sub.userId, sub.id, dateKey);
        }
      }
    }
    await notifyStoreBasketSummary(ctx, store.id, dateKey, batch);
  }

  let running = false;

  /**
   * Every minute: stores whose cutoff has passed today get tomorrow's orders. Running on after the cutoff minute means
   * a restart or a slow tick at the cutoff no longer skips a day; claimDate keeps each day to a single order.
   */
  async function processSubscriptions() {
    if (running) return;
    running = true;
    try {
      const stores = await app.prisma.store.findMany({
        where: { subscriptionEnabled: true, subscriptionCutoffTime: { lte: currentISTTime() } },
      });
      const start = tomorrowIST();
      const day = { start, end: endOfDayUTC(start) };
      for (const store of stores) {
        await processStore(store, day).catch((err: unknown) => app.log.error(err, `Failed to process subscriptions for store ${store.id}`));
      }
    } catch (err) {
      app.log.error(err, "Subscription scheduler: top-level error");
    } finally {
      running = false;
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
