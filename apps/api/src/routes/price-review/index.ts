import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  priceReviewBulkSchema, priceReviewDecideSchema, priceReviewGroupsQuerySchema, priceReviewItemsQuerySchema,
  priceReviewReopenSchema, priceReviewSummaryQuerySchema,
} from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, PriceReviewGroup, PriceReviewItem, PriceReviewResult, PriceReviewSummary } from "@martly/shared/types";
import { Permission } from "@martly/shared/constants";
import { forbiddenStoreProductFields } from "@martly/shared/permissions";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { requireOrgContext, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { priceReviewSummary } from "../../services/price-review/summary.js";
import { priceReviewGroups, priceReviewItems } from "../../services/price-review/listing.js";
import { bulkDecide, decidePrices, reopenPrices } from "../../services/price-review/decide.js";

const paged = <T>(items: T[], total: number, page: number, pageSize: number): PaginatedResponse<T> => ({
  success: true, data: items, meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
});

/** Settling the prices a store was onboarded with: progress, what to look at first, and keep/change/hide in one tap or in bulk */
export async function priceReviewRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authenticate, requireOrgContext, requirePermission(Permission.LISTING_PRICES)] };

  async function denied(request: FastifyRequest, reply: FastifyReply, storeId: string, hides: boolean) {
    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
    // Hiding takes a listing off the shelf, which is an availability duty on top of pricing
    if (hides && forbiddenStoreProductFields(request.user, { isActive: false }).length) return reply.forbidden("You can't hide products");
    return null;
  }

  app.get("/summary", opts, async (request, reply) => {
    const { storeId } = priceReviewSummaryQuerySchema.parse(request.query);
    if (await denied(request, reply, storeId, false)) return reply;
    return { success: true, data: await priceReviewSummary(app.prisma, storeId) } satisfies ApiResponse<PriceReviewSummary>;
  });

  app.get("/groups", opts, async (request, reply) => {
    const query = priceReviewGroupsQuerySchema.parse(request.query);
    if (await denied(request, reply, query.storeId, false)) return reply;
    const { items, total } = await priceReviewGroups(app.prisma, query);
    return paged<PriceReviewGroup>(items, total, query.page, query.pageSize);
  });

  app.get("/items", opts, async (request, reply) => {
    const query = priceReviewItemsQuerySchema.parse(request.query);
    if (await denied(request, reply, query.storeId, false)) return reply;
    const { items, total, counts } = await priceReviewItems(app.prisma, query);
    const page = paged<PriceReviewItem>(items, total, query.page, query.pageSize);
    return { ...page, meta: { ...page.meta, counts } };
  });

  app.post("/decide", opts, async (request, reply) => {
    const body = priceReviewDecideSchema.parse(request.body);
    if (await denied(request, reply, body.storeId, body.items.some((i) => i.hide))) return reply;
    return { success: true, data: await decidePrices(app.prisma, body, request.user.sub) } satisfies ApiResponse<PriceReviewResult>;
  });

  app.post("/bulk", opts, async (request, reply) => {
    const body = priceReviewBulkSchema.parse(request.body);
    if (await denied(request, reply, body.storeId, body.action === "hide")) return reply;
    return { success: true, data: await bulkDecide(app.prisma, body, request.user.sub) } satisfies ApiResponse<PriceReviewResult>;
  });

  app.post("/reopen", opts, async (request, reply) => {
    const body = priceReviewReopenSchema.parse(request.body);
    // Reopening puts hidden listings back on the shelf
    if (await denied(request, reply, body.storeId, true)) return reply;
    const reopened = await reopenPrices(app.prisma, body, request.user.sub);
    return { success: true, data: { reopened } } satisfies ApiResponse<{ reopened: number }>;
  });
}
