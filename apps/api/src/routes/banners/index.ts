import type { FastifyInstance } from "fastify";
import { bannerEventsSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { BannerPlacement } from "@martly/shared/constants";
import { recordBannerEvents } from "../../services/marketing/stats.js";
import { storeBanners } from "../../services/marketing/banner-feed.js";

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


  // Views and taps from the shopper app, batched; no login needed since guests see banners too
  app.post("/events", async (request) => {
    const { storeId, events } = bannerEventsSchema.parse(request.body);
    const recorded = await recordBannerEvents(app.prisma, storeId, events);
    return { success: true, data: { recorded } };
  });
}
