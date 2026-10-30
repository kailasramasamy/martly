import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { refreshBestSizes, withPreferredSizes } from "../services/preferred-sizes.js";

const INTERVAL_MS = 30 * 60 * 1000;

/** The size each shopper should land on (last bought, else most bought), marked on every listing a response carries */
async function preferredSizesPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;
  const refresh = () => refreshBestSizes(app.prisma).catch((err: unknown) => app.log.error(err, "Best size refresh failed"));

  app.addHook("preSerialization", async (request, _reply, payload) => {
    const user = request.user as { sub?: string; role?: string } | undefined;
    return withPreferredSizes(app.prisma, payload, user?.role === "CUSTOMER" ? user.sub : undefined);
  });

  app.addHook("onReady", async () => {
    await refresh();
    interval = setInterval(refresh, INTERVAL_MS);
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(preferredSizesPlugin, { name: "preferred-sizes" });
