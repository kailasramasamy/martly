import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { runCreditSweep } from "../services/credits/sweep.js";

const INTERVAL_MS = 60 * 60 * 1000;

/** Expires unused welcome credit and sends the reminder before it runs out */
async function creditSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("credit-sweep", () => runCreditSweep(app)), INTERVAL_MS);
    app.log.info("Credit scheduler started (hourly)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(creditSchedulerPlugin, { name: "credit-scheduler" });
