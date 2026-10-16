import type { FastifyInstance } from "fastify";
import { adjustStockSchema, receiveStockSchema } from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { applyMovement } from "../../services/stock-ledger.js";

/** Receiving deliveries, write-offs/corrections, and the movement history behind every stock number */
export async function stockMovementRoutes(app: FastifyInstance) {
  app.post("/receive", { preHandler: [authenticate, requirePermission(Permission.STOCK_RECEIVE)] }, async (request, reply) => {
    const body = receiveStockSchema.parse(request.body);
    if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) return reply.forbidden("Access denied");
    const ids = body.lines.map((l) => l.storeProductId);
    const inStore = await app.prisma.storeProduct.count({ where: { id: { in: ids }, storeId: body.storeId } });
    if (inStore !== new Set(ids).size) return reply.badRequest("Every product must be listed in this store");

    await app.prisma.$transaction(async (tx) => {
      for (const line of body.lines) {
        await applyMovement(tx, { ...line, type: "RECEIVE", note: body.note, userId: request.user.sub });
      }
    });
    const response: ApiResponse<{ received: number }> = { success: true, data: { received: body.lines.length } };
    return response;
  });

  app.post("/adjust", { preHandler: [authenticate, requirePermission(Permission.STOCK_ADJUST)] }, async (request, reply) => {
    const body = adjustStockSchema.parse(request.body);
    const sp = await app.prisma.storeProduct.findUnique({ where: { id: body.storeProductId }, select: { storeId: true } });
    if (!sp) return reply.notFound("Store product not found");
    if (!(await verifyStoreOrgAccess(request, app.prisma, sp.storeId))) return reply.forbidden("Access denied");

    const movement = await app.prisma.$transaction((tx) => applyMovement(tx, { ...body, userId: request.user.sub }));
    const response: ApiResponse<typeof movement> = { success: true, data: movement };
    return response;
  });

  app.get("/movements", { preHandler: [authenticate, requirePermission(Permission.STOCK_VIEW)] }, async (request, reply) => {
    const { storeProductId, storeId, page = 1, pageSize = 30 } = request.query as {
      storeProductId?: string; storeId?: string; page?: number; pageSize?: number;
    };
    const scope = await getOrgStoreIds(request, app.prisma);
    if (storeId && !(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied");
    const where = {
      ...(storeProductId ? { storeProductId } : {}),
      ...(storeId ? { storeId } : scope ? { storeId: { in: scope } } : {}),
    };
    const take = Math.min(Number(pageSize), 100);
    const [rows, total] = await Promise.all([
      app.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * take,
        take,
        include: {
          user: { select: { id: true, name: true } },
          storeProduct: { select: { product: { select: { name: true } }, variant: { select: { name: true } } } },
        },
      }),
      app.prisma.stockMovement.count({ where }),
    ]);
    const response: PaginatedResponse<(typeof rows)[0]> = {
      success: true,
      data: rows,
      meta: { total, page: Number(page), pageSize: take, totalPages: Math.ceil(total / take) },
    };
    return response;
  });
}
