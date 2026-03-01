import type { FastifyInstance } from "fastify";
import { createReviewSchema, updateReviewSchema, updateReviewStatusSchema, createReviewReplySchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

const reviewInclude = {
  user: { select: { id: true, name: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  reply: { include: { user: { select: { id: true, name: true } } } },
};

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
        include: reviewInclude,
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

  // GET /my-reviews?productIds=a,b,c - Customer's own reviews for given products
  app.get("/my-reviews", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    const { productIds } = request.query as { productIds?: string };

    if (!productIds) {
      const response: ApiResponse<never[]> = { success: true, data: [] };
      return response;
    }

    const ids = productIds.split(",").filter(Boolean);
    const reviews = await app.prisma.review.findMany({
      where: { userId: user.sub, productId: { in: ids } },
      include: reviewInclude,
    });

    const response: ApiResponse<typeof reviews> = { success: true, data: reviews };
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

    const review = await app.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          userId: user.sub,
          productId: body.productId,
          storeId: body.storeId,
          orderId: body.orderId,
          rating: body.rating,
          title: body.title,
          comment: body.comment,
          isVerified: !!deliveredOrder,
          status: "PENDING",
        },
      });

      // Create images if provided
      if (body.imageUrls?.length) {
        await tx.reviewImage.createMany({
          data: body.imageUrls.map((url, i) => ({
            reviewId: created.id,
            imageUrl: url,
            sortOrder: i,
          })),
        });
      }

      return tx.review.findUniqueOrThrow({
        where: { id: created.id },
        include: reviewInclude,
      });
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

    const updated = await app.prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: request.params.id },
        data: { rating: body.rating, title: body.title, comment: body.comment, status: "PENDING" },
      });

      // Replace images if provided
      if (body.imageUrls !== undefined) {
        await tx.reviewImage.deleteMany({ where: { reviewId: request.params.id } });
        if (body.imageUrls?.length) {
          await tx.reviewImage.createMany({
            data: body.imageUrls.map((url, i) => ({
              reviewId: request.params.id,
              imageUrl: url,
              sortOrder: i,
            })),
          });
        }
      }

      return tx.review.findUniqueOrThrow({
        where: { id: request.params.id },
        include: reviewInclude,
      });
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

  // POST /:id/reply - Admin/Manager reply to a review
  app.post<{ Params: { id: string } }>("/:id/reply", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
  }, async (request, reply) => {
    const body = createReviewReplySchema.parse(request.body);
    const user = request.user as { sub: string };

    const review = await app.prisma.review.findUnique({ where: { id: request.params.id } });
    if (!review) return reply.notFound("Review not found");

    const replyData = await app.prisma.reviewReply.upsert({
      where: { reviewId: request.params.id },
      create: {
        reviewId: request.params.id,
        userId: user.sub,
        body: body.body,
      },
      update: {
        userId: user.sub,
        body: body.body,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    const response: ApiResponse<typeof replyData> = { success: true, data: replyData };
    return response;
  });

  // DELETE /:id/reply - Admin/Manager delete reply
  app.delete<{ Params: { id: string } }>("/:id/reply", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
  }, async (request, reply) => {
    const existing = await app.prisma.reviewReply.findUnique({ where: { reviewId: request.params.id } });
    if (!existing) return reply.notFound("Reply not found");

    await app.prisma.reviewReply.delete({ where: { reviewId: request.params.id } });
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
          images: { orderBy: { sortOrder: "asc" } },
          reply: { include: { user: { select: { id: true, name: true } } } },
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

  // PATCH /:id/status - Admin: approve/reject + award loyalty points on approve if verified
  app.patch<{ Params: { id: string } }>("/:id/status", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const body = updateReviewStatusSchema.parse(request.body);

    const review = await app.prisma.review.findUnique({
      where: { id: request.params.id },
      include: { store: { select: { organizationId: true } } },
    });
    if (!review) return reply.notFound("Review not found");

    const updated = await app.prisma.$transaction(async (tx) => {
      const result = await tx.review.update({
        where: { id: request.params.id },
        data: { status: body.status },
        include: { user: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } },
      });

      // Award loyalty points when a verified review is approved
      if (body.status === "APPROVED" && review.isVerified && review.store?.organizationId) {
        const orgId = review.store.organizationId;
        const loyaltyConfig = await tx.loyaltyConfig.findUnique({ where: { organizationId: orgId } });

        if (loyaltyConfig?.isEnabled && loyaltyConfig.reviewRewardPoints > 0) {
          const balance = await tx.loyaltyBalance.upsert({
            where: { userId_organizationId: { userId: review.userId, organizationId: orgId } },
            create: {
              userId: review.userId,
              organizationId: orgId,
              points: loyaltyConfig.reviewRewardPoints,
              totalEarned: loyaltyConfig.reviewRewardPoints,
            },
            update: {
              points: { increment: loyaltyConfig.reviewRewardPoints },
              totalEarned: { increment: loyaltyConfig.reviewRewardPoints },
            },
          });

          await tx.loyaltyTransaction.create({
            data: {
              userId: review.userId,
              organizationId: orgId,
              type: "EARN",
              points: loyaltyConfig.reviewRewardPoints,
              balanceAfter: balance.points,
              description: `Review reward for ${result.product.name}`,
            },
          });
        }
      }

      return result;
    });

    const response: ApiResponse<typeof updated> = { success: true, data: updated };
    return response;
  });
}
