import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { alertStaleRiders, alertUnclaimedFailures } from "../services/notify/delivery-alerts.js";

const INTERVAL_MS = 60_000;

/** Watches the road: riders who go quiet mid-trip, and failed deliveries nobody has picked up again */
async function deliveryAlertsSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(() => {
      Promise.all([alertStaleRiders(app.fcm, app.prisma), alertUnclaimedFailures(app.fcm, app.prisma)])
        .catch((err: unknown) => app.log.error(err, "Delivery alerts scheduler run failed"));
    }, INTERVAL_MS);
    app.log.info("Delivery alerts scheduler started (every minute)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(deliveryAlertsSchedulerPlugin, { name: "delivery-alerts-scheduler" });
