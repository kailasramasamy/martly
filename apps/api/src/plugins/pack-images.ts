import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { applyPackImages, refreshPackImages } from "../services/pack-images.js";

const INTERVAL_MS = 5 * 60 * 1000;

/** Stores' own pack images: rendered in the background, swapped into every response that lists store products */
async function packImagesPlugin(app: FastifyInstance) {
  let interval: ReturnType<typeof setInterval> | undefined;
  const refresh = () => refreshPackImages(app.prisma).catch((err: unknown) => app.log.error(err, "Pack image refresh failed"));

  app.addHook("preSerialization", async (_request, _reply, payload) => {
    applyPackImages(payload);
    return payload;
  });

  app.addHook("onReady", async () => {
    void refresh();
    interval = setInterval(refresh, INTERVAL_MS);
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(packImagesPlugin, { name: "pack-images" });
