import type { FastifyInstance } from "fastify";
import { createStoreRatingSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds } from "../../middleware/org-scope.js";

export async function storeRatingRoutes(app: FastifyInstance) {
  // POST / - Create store rating (customer, order must be DELIVERED)
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createStoreRatingSchema.parse(request.body);
    const user = request.user as { sub: string };

    // Verify order belongs to user and is delivered
    const order = await app.prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order) return reply.notFound("Order not found");
    if (order.userId !== user.sub) return reply.forbidden("Access denied");
    if (order.status !== "DELIVERED") {
      return reply.badRequest("Can only rate delivered orders");
    }
    if (order.storeId !== body.storeId) {
      return reply.badRequest("Store does not match order");
    }

    // Check for existing rating
    const existing = await app.prisma.storeRating.findUnique({
      where: { userId_orderId: { userId: user.sub, orderId: body.orderId } },
    });
    if (existing) {
      return reply.status(409).send({ success: false, error: "Duplicate", message: "You already rated this order", statusCode: 409 });
    }

    const rating = await app.prisma.storeRating.create({
      data: {
        userId: user.sub,
        orderId: body.orderId,
        storeId: body.storeId,
        overallRating: body.overallRating,
        deliveryRating: body.deliveryRating,
        packagingRating: body.packagingRating,
        comment: body.comment,
      },
    });

    const response: ApiResponse<typeof rating> = { success: true, data: rating };
    return response;
  });

  // GET /order/:orderId - Get user's rating for an order
  app.get<{ Params: { orderId: string } }>("/order/:orderId", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };

    const rating = await app.prisma.storeRating.findUnique({
      where: { userId_orderId: { userId: user.sub, orderId: request.params.orderId } },
    });

    const response: ApiResponse<typeof rating> = { success: true, data: rating };
    return response;
  });

  // GET /store/:storeId/summary - Average ratings for a store
  app.get<{ Params: { storeId: string } }>("/store/:storeId/summary", { preHandler: [authenticateOptional] }, async (request) => {
    const ratings = await app.prisma.storeRating.findMany({
      where: { storeId: request.params.storeId },
      select: { overallRating: true, deliveryRating: true, packagingRating: true },
    });

    const count = ratings.length;
    if (count === 0) {
      const response: ApiResponse<{ count: number; overall: number; delivery: number; packaging: number }> = {
        success: true,
        data: { count: 0, overall: 0, delivery: 0, packaging: 0 },
      };
      return response;
    }

    const overall = ratings.reduce((s, r) => s + r.overallRating, 0) / count;
    const deliveryRatings = ratings.filter((r) => r.deliveryRating != null);
    const packagingRatings = ratings.filter((r) => r.packagingRating != null);
    const delivery = deliveryRatings.length > 0 ? deliveryRatings.reduce((s, r) => s + r.deliveryRating!, 0) / deliveryRatings.length : 0;
    const packaging = packagingRatings.length > 0 ? packagingRatings.reduce((s, r) => s + r.packagingRating!, 0) / packagingRatings.length : 0;

    const response: ApiResponse<{ count: number; overall: number; delivery: number; packaging: number }> = {
      success: true,
      data: {
        count,
        overall: Math.round(overall * 10) / 10,
        delivery: Math.round(delivery * 10) / 10,
        packaging: Math.round(packaging * 10) / 10,
      },
    };
    return response;
  });

  // GET /admin - Admin: paginated list of store ratings
  app.get("/admin", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
  }, async (request) => {
    const { storeId, page = 1, pageSize = 20 } = request.query as { storeId?: string; page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const storeIds = await getOrgStoreIds(request, app.prisma);
    const where: Record<string, unknown> = {};
    if (storeId) {
      where.storeId = storeId;
    } else if (storeIds) {
      where.storeId = { in: storeIds };
    }

    const [ratings, total] = await Promise.all([
      app.prisma.storeRating.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
          store: { select: { id: true, name: true } },
          order: { select: { id: true, createdAt: true } },
        },
      }),
      app.prisma.storeRating.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof ratings)[0]> = {
      success: true,
      data: ratings,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });
}
