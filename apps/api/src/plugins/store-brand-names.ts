import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { refreshStoreBrands, withStoreBrandNames } from "../services/store-brand-names.js";

const INTERVAL_MS = 5 * 60 * 1000;

/** Stores' own packs titled under the store's brand ("Ranga Toor Dal") in every response that shows them in a store */
async function storeBrandNamesPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;
  const refresh = () => refreshStoreBrands(app.prisma).catch((err: unknown) => app.log.error(err, "Store brand refresh failed"));

  app.addHook("preSerialization", async (request, _reply, payload) => {
    const { storeId } = (request.query ?? {}) as { storeId?: unknown };
    return withStoreBrandNames(payload, typeof storeId === "string" ? storeId : undefined);
  });

  app.addHook("onReady", async () => {
    await refresh();
    interval = setInterval(refresh, INTERVAL_MS);
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(storeBrandNamesPlugin, { name: "store-brand-names" });
