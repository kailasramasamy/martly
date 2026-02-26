import type { FastifyInstance } from "fastify";
import { createCouponSchema, updateCouponSchema, applyCouponSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";

export async function couponRoutes(app: FastifyInstance) {
  // GET / - List coupons (org-scoped)
  app.get("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};
    if (user.role !== "SUPER_ADMIN" && user.organizationId) {
      where.organizationId = user.organizationId;
    }

    const [coupons, total] = await Promise.all([
      app.prisma.coupon.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
      }),
      app.prisma.coupon.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof coupons)[0]> = {
      success: true,
      data: coupons,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // GET /:id - Coupon detail
  app.get<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const coupon = await app.prisma.coupon.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!coupon) return reply.notFound("Coupon not found");

    const response: ApiResponse<typeof coupon> = { success: true, data: coupon };
    return response;
  });

  // POST / - Create coupon
  app.post("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const body = createCouponSchema.parse(request.body);
    const user = getOrgUser(request);

    // Auto-set organizationId for ORG_ADMIN
    const orgId = body.organizationId ?? (user.role !== "SUPER_ADMIN" ? user.organizationId : null);

    // Check for duplicate code
    const existing = await app.prisma.coupon.findUnique({ where: { code: body.code } });
    if (existing) return reply.conflict("A coupon with this code already exists");

    const coupon = await app.prisma.coupon.create({
      data: {
        code: body.code,
        discountType: body.discountType,
        discountValue: body.discountValue,
        perUserLimit: body.perUserLimit,
        isActive: body.isActive,
        organizationId: orgId ?? undefined,
        description: body.description ?? undefined,
        minOrderAmount: body.minOrderAmount ?? undefined,
        maxDiscount: body.maxDiscount ?? undefined,
        usageLimit: body.usageLimit ?? undefined,
        startsAt: body.startsAt ?? undefined,
        expiresAt: body.expiresAt ?? undefined,
      },
    });

    const response: ApiResponse<typeof coupon> = { success: true, data: coupon };
    return response;
  });

  // PUT /:id - Update coupon
  app.put<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const body = updateCouponSchema.parse(request.body);

    const existing = await app.prisma.coupon.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Coupon not found");

    // Check code uniqueness if changing
    if (body.code && body.code !== existing.code) {
      const dup = await app.prisma.coupon.findUnique({ where: { code: body.code } });
      if (dup) return reply.conflict("A coupon with this code already exists");
    }

    const coupon = await app.prisma.coupon.update({
      where: { id: request.params.id },
      data: body,
    });

    const response: ApiResponse<typeof coupon> = { success: true, data: coupon };
    return response;
  });

  // DELETE /:id - Delete coupon
  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const existing = await app.prisma.coupon.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Coupon not found");

    await app.prisma.coupon.delete({ where: { id: request.params.id } });
    const response: ApiResponse<{ deleted: boolean }> = { success: true, data: { deleted: true } };
    return response;
  });

  // POST /validate - Validate coupon for checkout
  app.post("/validate", { preHandler: [authenticate] }, async (request, reply) => {
    const body = applyCouponSchema.parse(request.body);
    const user = request.user as { sub: string };
    const code = body.code.toUpperCase();

    const coupon = await app.prisma.coupon.findUnique({ where: { code } });

    if (!coupon) {
      return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "Coupon not found", statusCode: 400 });
    }

    if (!coupon.isActive) {
      return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "This coupon is no longer active", statusCode: 400 });
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "This coupon is not yet active", statusCode: 400 });
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "This coupon has expired", statusCode: 400 });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "This coupon has reached its usage limit", statusCode: 400 });
    }

    // Check per-user limit
    const userRedemptions = await app.prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: user.sub },
    });
    if (userRedemptions >= coupon.perUserLimit) {
      return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "You have already used this coupon", statusCode: 400 });
    }

    // Check min order amount
    if (coupon.minOrderAmount && body.orderAmount < Number(coupon.minOrderAmount)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid Coupon",
        message: `Minimum order amount is ₹${Number(coupon.minOrderAmount)}`,
        statusCode: 400,
      });
    }

    // Check org scope
    if (coupon.organizationId) {
      const store = await app.prisma.store.findUnique({ where: { id: body.storeId } });
      if (store && store.organizationId !== coupon.organizationId) {
        return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "This coupon is not valid for this store", statusCode: 400 });
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "FLAT") {
      discount = Number(coupon.discountValue);
    } else {
      discount = (body.orderAmount * Number(coupon.discountValue)) / 100;
    }
    if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
      discount = Number(coupon.maxDiscount);
    }
    discount = Math.min(discount, body.orderAmount);

    const response: ApiResponse<{ valid: boolean; discount: number; code: string; description: string | null }> = {
      success: true,
      data: { valid: true, discount: Math.round(discount * 100) / 100, code: coupon.code, description: coupon.description },
    };
    return response;
  });
}
