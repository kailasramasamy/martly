import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { istNow } from "../services/ist-day.js";
import { runWishlistAlerts } from "../services/notify/wishlist-alerts.js";

const INTERVAL_MS = 10 * 60_000;
const RUN_AT_MINUTES = 10 * 60;

/** Around 10:00 IST each day, tells customers when a wishlisted item is back or cheaper */
async function wishlistAlertSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(() => {
      if (istNow().minutes < RUN_AT_MINUTES) return;
      runWishlistAlerts(app.fcm, app.prisma).catch((err: unknown) => app.log.error(err, "Wishlist alerts run failed"));
    }, INTERVAL_MS);
    app.log.info("Wishlist alert scheduler started (daily ~10:00 IST)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(wishlistAlertSchedulerPlugin, { name: "wishlist-alert-scheduler" });
