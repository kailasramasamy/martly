import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { applyStoreOfferSchema, endStoreOfferSchema, storeOffersQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, StoreOffer } from "@martly/shared/types";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { requireOrgContext, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { applyStoreOffer, endStoreOffer, listStoreOffers, storeListings } from "../../services/store-offers.js";

/** Buy X get Y and discounts across a store's listings: list them, put one on many listings, end them */
export async function offerRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authenticate, requireOrgContext, requirePermission(Permission.LISTING_PRICES)] };

  // Every listing must be this store's, and the caller must manage the store
  async function guard(request: FastifyRequest, reply: FastifyReply, storeId: string, ids: string[]) {
    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
    const listings = await storeListings(app.prisma, storeId, ids);
    if (listings.length !== new Set(ids).size) return reply.badRequest("Some products aren't listed at this store");
    return listings;
  }

  app.get("/", opts, async (request, reply) => {
    const query = storeOffersQuerySchema.parse(request.query);
    if (!(await verifyStoreOrgAccess(request, app.prisma, query.storeId))) return reply.forbidden("Access denied to this store");
    const { items, total } = await listStoreOffers(app.prisma, query);
    return {
      success: true,
      data: items,
      meta: { total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
    } satisfies PaginatedResponse<StoreOffer>;
  });

  app.post("/", opts, async (request, reply) => {
    const body = applyStoreOfferSchema.parse(request.body);
    const listings = await guard(request, reply, body.storeId, body.storeProductIds);
    if (!Array.isArray(listings)) return listings;
    if (body.kind === "DISCOUNT" && body.discountType === "FLAT") {
      const tooBig = listings.filter((l) => Number(l.price) <= body.discountValue);
      if (tooBig.length) {
        const names = tooBig.slice(0, 3).map((l) => `${l.product.name} ${l.variant.name}`).join(", ");
        return reply.badRequest(`The discount is more than the price of ${names}${tooBig.length > 3 ? ` and ${tooBig.length - 3} more` : ""}`);
      }
    }
    const updated = await applyStoreOffer(app.prisma, body);
    return { success: true, data: { updated } } satisfies ApiResponse<{ updated: number }>;
  });

  app.post("/end", opts, async (request, reply) => {
    const body = endStoreOfferSchema.parse(request.body);
    const listings = await guard(request, reply, body.storeId, body.storeProductIds);
    if (!Array.isArray(listings)) return listings;
    const ended = await endStoreOffer(app.prisma, body);
    return { success: true, data: { ended } } satisfies ApiResponse<{ ended: number }>;
  });
}
