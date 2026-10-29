import type { FastifyInstance } from "fastify";
import { bannerEventsSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { BannerPlacement } from "@martly/shared/constants";
import { recordBannerEvents } from "../../services/marketing/stats.js";
import { storeBanners } from "../../services/marketing/banner-feed.js";
import { authenticateOptional } from "../../middleware/auth.js";
import { byClient, rateLimits } from "../../middleware/rate-limit.js";

/** What shoppers see of banners: the live ones per placement, and the views and taps they report back */
export async function bannerRoutes(app: FastifyInstance) {
  // Public: fetch active banners by placement for a store
  app.get<{ Params: { storeId: string } }>(
    "/by-placement/:storeId",
    async (request, reply) => {
      const { storeId } = request.params;
      const { placement, categoryId, departmentId, subcategoryId } = request.query as { placement?: string; categoryId?: string; departmentId?: string; subcategoryId?: string };

      if (!placement || !(placement in BannerPlacement)) return reply.badRequest("placement query param is required");

      const store = await app.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, organizationId: true },
      });
      if (!store) return reply.notFound("Store not found");

      const kind = placement as BannerPlacement;
      const taxFilter = subcategoryId ? { subcategoryId } : categoryId ? { categoryId } : departmentId ? { departmentId } : null;
      // A category page shows banners made for it, else the general ones for that placement
      let banners = taxFilter ? await storeBanners(app.prisma, store, [kind], taxFilter) : [];
      if (!taxFilter || banners.length === 0) {
        banners = await storeBanners(app.prisma, store, [kind], taxFilter ? { departmentId: null, categoryId: null, subcategoryId: null } : {});
      }

      const response: ApiResponse<typeof banners> = { success: true, data: banners };
      return response;
    },
  );


  // Views and taps from the shopper app and martlyshop.in, batched; no login needed since guests see banners too.
  // The app flushes every 15 s and the site every 2 s or on a tap, so 30 a minute per shopper (or per IP for guests) is plenty
  const eventsLimit = rateLimits(app, [{ max: 30, window: "1 minute", key: byClient }]);
  app.post("/events", { preHandler: [authenticateOptional, eventsLimit] }, async (request) => {
    const { storeId, events } = bannerEventsSchema.parse(request.body);
    const recorded = await recordBannerEvents(app.prisma, storeId, events);
    return { success: true, data: { recorded } };
  });
}
