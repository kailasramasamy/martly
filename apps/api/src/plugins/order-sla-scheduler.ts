import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { runOrderSlaChecks } from "../services/notify/order-alerts.js";

const INTERVAL_MS = 60_000;

/** Cancels online orders left unpaid and alerts staff when orders sit too long in a status */
async function orderSlaSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("order-sla", () => runOrderSlaChecks(app)), INTERVAL_MS);
    app.log.info("Order SLA scheduler started (every minute)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(orderSlaSchedulerPlugin, { name: "order-sla-scheduler" });
