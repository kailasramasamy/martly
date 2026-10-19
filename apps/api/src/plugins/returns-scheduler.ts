import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { runReturnSweep } from "../services/returns/sweep.js";

const INTERVAL_MS = 60 * 60 * 1000;

/** Moves uncollected returns to a store drop, expires items never returned, and refunds replacements that never went out */
async function returnsSchedulerPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(() => {
      runReturnSweep(app).catch((err: unknown) => app.log.error(err, "Returns scheduler run failed"));
    }, INTERVAL_MS);
    app.log.info("Returns scheduler started (hourly)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(returnsSchedulerPlugin, { name: "returns-scheduler" });
