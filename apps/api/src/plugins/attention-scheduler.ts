import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { escalateStaleWork } from "../services/notify/attention-alerts.js";

const INTERVAL_MS = 5 * 60 * 1000;

/** Escalates work left waiting past its limit (returns, dispatch, counts, reviews, tickets, drafts) to the owners */
async function attentionSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("attention", () => escalateStaleWork(app.fcm, app.prisma)), INTERVAL_MS);
    app.log.info("Attention scheduler started (every 5 minutes)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(attentionSchedulerPlugin, { name: "attention-scheduler" });
