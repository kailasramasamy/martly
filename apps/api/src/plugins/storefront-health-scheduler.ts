import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { storefrontHealth } from "../services/storefront/health.js";

const INTERVAL_MS = 6 * 60 * 60_000;

/** Records every active store's storefront score a few times a day, so each has a daily point for its trend */
async function storefrontHealthSchedulerPlugin(app: FastifyInstance) {
  async function run() {
    const stores = await app.prisma.store.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    for (const store of stores) await storefrontHealth(app.prisma, store.id, true);
  }

  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(() => {
      run().catch((err: unknown) => app.log.error(err, "Storefront health run failed"));
    }, INTERVAL_MS);
    app.log.info("Storefront health scheduler started (every 6 h)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(storefrontHealthSchedulerPlugin, { name: "storefront-health-scheduler" });
