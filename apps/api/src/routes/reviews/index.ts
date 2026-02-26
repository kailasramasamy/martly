import type { FastifyInstance } from "fastify";
import { createReviewSchema, updateReviewSchema, updateReviewStatusSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

export async function reviewRoutes(app: FastifyInstance) {
  // GET /?productId=X - List approved reviews for a product
  app.get("/", { preHandler: [authenticateOptional] }, async (request) => {
    const { productId, page = 1, pageSize = 20 } = request.query as { productId?: string; page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Record<string, unknown> = { status: "APPROVED" };
    if (productId) where.productId = productId;

    const [reviews, total] = await Promise.all([
      app.prisma.review.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      }),
      app.prisma.review.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof reviews)[0]> = {
      success: true,
      data: reviews,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // GET /product/:productId/summary - Rating summary
  app.get<{ Params: { productId: string } }>("/product/:productId/summary", { preHandler: [authenticateOptional] }, async (request) => {
    const { productId } = request.params;

    const reviews = await app.prisma.review.findMany({
      where: { productId, status: "APPROVED" },
      select: { rating: true },
    });

    const count = reviews.length;
    const average = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) distribution[r.rating]++;

    const response: ApiResponse<{ average: number; count: number; distribution: Record<number, number> }> = {
      success: true,
      data: { average: Math.round(average * 10) / 10, count, distribution },
    };
    return response;
  });

  // POST / - Create review
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createReviewSchema.parse(request.body);
    const user = request.user as { sub: string };

    // Check for existing review
    const existing = await app.prisma.review.findUnique({
      where: { userId_productId: { userId: user.sub, productId: body.productId } },
    });
    if (existing) {
      return reply.status(409).send({ success: false, error: "Duplicate", message: "You already reviewed this product", statusCode: 409 });
    }

    // Auto-verify if user has a delivered order containing this product
    const deliveredOrder = await app.prisma.order.findFirst({
      where: {
        userId: user.sub,
        status: "DELIVERED",
        items: { some: { productId: body.productId } },
      },
    });

    const review = await app.prisma.review.create({
      data: {
        userId: user.sub,
        productId: body.productId,
        storeId: body.storeId,
        rating: body.rating,
        title: body.title,
        comment: body.comment,
        isVerified: !!deliveredOrder,
        status: "PENDING",
      },
      include: { user: { select: { id: true, name: true } } },
    });

    const response: ApiResponse<typeof review> = { success: true, data: review };
    return response;
  });

  // PUT /:id - Update own review
  app.put<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const body = updateReviewSchema.parse(request.body);
    const user = request.user as { sub: string };

    const review = await app.prisma.review.findUnique({ where: { id: request.params.id } });
    if (!review) return reply.notFound("Review not found");
    if (review.userId !== user.sub) return reply.forbidden("Access denied");

    const updated = await app.prisma.review.update({
      where: { id: request.params.id },
      data: { ...body, status: "PENDING" },
      include: { user: { select: { id: true, name: true } } },
    });

    const response: ApiResponse<typeof updated> = { success: true, data: updated };
    return response;
  });

  // DELETE /:id - Delete own review
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };

    const review = await app.prisma.review.findUnique({ where: { id: request.params.id } });
    if (!review) return reply.notFound("Review not found");
    if (review.userId !== user.sub) return reply.forbidden("Access denied");

    await app.prisma.review.delete({ where: { id: request.params.id } });
    const response: ApiResponse<{ deleted: boolean }> = { success: true, data: { deleted: true } };
    return response;
  });

  // GET /moderation - Admin: list all reviews with status filter
  app.get("/moderation", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request) => {
    const { status, page = 1, pageSize = 20 } = request.query as { status?: string; page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [reviews, total] = await Promise.all([
      app.prisma.review.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
      app.prisma.review.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof reviews)[0]> = {
      success: true,
      data: reviews,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // PATCH /:id/status - Admin: approve/reject
  app.patch<{ Params: { id: string } }>("/:id/status", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const body = updateReviewStatusSchema.parse(request.body);

    const review = await app.prisma.review.findUnique({ where: { id: request.params.id } });
    if (!review) return reply.notFound("Review not found");

    const updated = await app.prisma.review.update({
      where: { id: request.params.id },
      data: { status: body.status },
      include: { user: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } },
    });

    const response: ApiResponse<typeof updated> = { success: true, data: updated };
    return response;
  });
}
