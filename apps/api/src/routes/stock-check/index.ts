import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  stockCheckBrandsQuerySchema, stockCheckDecideSchema, stockCheckEditSchema, stockCheckProductsQuerySchema, stockCheckSizesSchema,
  stockCheckSummaryQuerySchema, stockCheckUndoSchema,
} from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, StockCheckBrand, StockCheckEditResult, StockCheckProduct, StockCheckResult, StockCheckSummary } from "@martly/shared/types";
import { Permission } from "@martly/shared/constants";
import { forbiddenStoreProductFields } from "@martly/shared/permissions";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { requireOrgContext, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { stockCheckSummary } from "../../services/stock-check/summary.js";
import { stockCheckBrands, stockCheckProducts } from "../../services/stock-check/listing.js";
import { decideCarried, saveSizes } from "../../services/stock-check/decide.js";
import { undoBatch } from "../../services/stock-check/carry.js";
import { editProduct } from "../../services/stock-check/edit.js";

/** Confirming which onboarded products a store really carries: department, then brand, then sizes */
export async function stockCheckRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authenticate, requireOrgContext, requirePermission(Permission.LISTING_AVAILABILITY)] };

  async function denied(request: FastifyRequest, reply: FastifyReply, storeId: string) {
    if (await verifyStoreOrgAccess(request, app.prisma, storeId)) return null;
    return reply.forbidden("Access denied to this store");
  }

  app.get("/summary", opts, async (request, reply) => {
    const { storeId } = stockCheckSummaryQuerySchema.parse(request.query);
    if (await denied(request, reply, storeId)) return reply;
    return { success: true, data: await stockCheckSummary(app.prisma, storeId) } satisfies ApiResponse<StockCheckSummary>;
  });

  app.get("/brands", opts, async (request, reply) => {
    const query = stockCheckBrandsQuerySchema.parse(request.query);
    if (await denied(request, reply, query.storeId)) return reply;
    const { items, total } = await stockCheckBrands(app.prisma, query);
    return {
      success: true, data: items,
      meta: { total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
    } satisfies PaginatedResponse<StockCheckBrand>;
  });

  app.get("/products", opts, async (request, reply) => {
    const query = stockCheckProductsQuerySchema.parse(request.query);
    if (await denied(request, reply, query.storeId)) return reply;
    return { success: true, data: await stockCheckProducts(app.prisma, query) } satisfies ApiResponse<StockCheckProduct[]>;
  });

  app.post("/decide", opts, async (request, reply) => {
    const body = stockCheckDecideSchema.parse(request.body);
    if (await denied(request, reply, body.storeId)) return reply;
    return { success: true, data: await decideCarried(app.prisma, body, request.user.sub) } satisfies ApiResponse<StockCheckResult>;
  });

  app.post("/sizes", opts, async (request, reply) => {
    const body = stockCheckSizesSchema.parse(request.body);
    if (await denied(request, reply, body.storeId)) return reply;
    return { success: true, data: await saveSizes(app.prisma, body, request.user.sub) } satisfies ApiResponse<StockCheckResult>;
  });

  app.post("/edit", opts, async (request, reply) => {
    const body = stockCheckEditSchema.parse(request.body);
    if (await denied(request, reply, body.storeId)) return reply;
    // Setting a price is a pricing duty on top of confirming the range
    if (forbiddenStoreProductFields(request.user, { price: 1 }).length) return reply.forbidden("You can't change prices");
    const store = await app.prisma.store.findUniqueOrThrow({ where: { id: body.storeId }, select: { id: true, organizationId: true } });
    return { success: true, data: await editProduct(app.prisma, store, body, request.user.sub) } satisfies ApiResponse<StockCheckEditResult>;
  });

  app.post("/undo", opts, async (request, reply) => {
    const body = stockCheckUndoSchema.parse(request.body);
    if (await denied(request, reply, body.storeId)) return reply;
    const undone = await undoBatch(app.prisma, body.storeId, body.batch, request.user.sub);
    return { success: true, data: { undone } } satisfies ApiResponse<{ undone: number }>;
  });
}
