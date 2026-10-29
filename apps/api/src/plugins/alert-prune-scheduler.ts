import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { pruneAlertKeys } from "../services/notify/once.js";

const INTERVAL_MS = 6 * 60 * 60_000;

/** Drops one-time alert keys once no scanner can look back far enough to raise their alert again */
async function alertPruneSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  const run = async () => {
    const deleted = await pruneAlertKeys(app.prisma);
    if (deleted > 0) app.log.info(`Pruned ${deleted} old alert keys`);
  };

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("alert-prune", run), INTERVAL_MS);
    app.log.info("Alert key prune scheduler started (every 6 h)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(alertPruneSchedulerPlugin, { name: "alert-prune-scheduler" });
