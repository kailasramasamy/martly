import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { refreshDueSnapshots } from "../services/storefront/schedule.js";

// How often to look for stores whose snapshot is missing or stale; the refresh age itself is read from the snapshots,
// so a restart doesn't push the next run back
const CHECK_MS = 15 * 60_000;

/** Records every active store's storefront score a few times a day, so each has a daily point for its trend */
async function storefrontHealthSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("storefront-health", () => refreshDueSnapshots(app.prisma)), CHECK_MS);
    app.log.info("Storefront health scheduler started (checks every 15 min, refreshes snapshots older than 6 h)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(storefrontHealthSchedulerPlugin, { name: "storefront-health-scheduler" });
