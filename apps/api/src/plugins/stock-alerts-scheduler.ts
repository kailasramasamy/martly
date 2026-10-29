import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { scanStockCrossings } from "../services/notify/stock-alerts.js";

const INTERVAL_MS = 5 * 60_000;

/** Every few minutes, tells stock staff which sellers have run low or out */
async function stockAlertsSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("stock-alerts", () => scanStockCrossings(app.fcm, app.prisma)), INTERVAL_MS);
    app.log.info("Stock alerts scheduler started (every 5 minutes)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(stockAlertsSchedulerPlugin, { name: "stock-alerts-scheduler" });
