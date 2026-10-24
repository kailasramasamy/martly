import type { FastifyInstance, FastifyRequest } from "fastify";
import { createCouponSchema, updateCouponSchema, applyCouponSchema, availableCouponsQuerySchema, type UpdateCouponInput } from "@martly/shared/schemas";
import type { ApiResponse, CouponOffer, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { getOrgUser } from "../../middleware/org-scope.js";
import { checkCoupon } from "../../services/coupons.js";
import { couponOffers } from "../../services/coupon-offers.js";
import { translateCoupon } from "../../services/translate/coupon.js";
import type { Prisma } from "../../../generated/prisma/client.js";

function canAccessCoupon(request: FastifyRequest, coupon: { organizationId: string | null }) {
  const user = getOrgUser(request);
  return user.role === "SUPER_ADMIN" || coupon.organizationId === user.organizationId;
}

type TaText = { title?: string; description?: string };

// A new English headline or description outdates its Tamil unless the edit sends Tamil too; the dropped field is
// translated again after the save
function staleTamilDropped(existing: { title: string | null; description: string | null; translations: unknown }, body: UpdateCouponInput) {
  if (body.translations !== undefined) return (body.translations ?? undefined) as Prisma.InputJsonValue | undefined;
  const all = (existing.translations ?? {}) as Record<string, TaText>;
  const ta = { ...all.ta };
  if (body.title !== undefined && body.title !== existing.title) delete ta.title;
  if (body.description !== undefined && body.description !== existing.description) delete ta.description;
  return { ...all, ta } as Prisma.InputJsonValue;
}

export async function couponRoutes(app: FastifyInstance) {
  // GET / - List coupons (org-scoped)
  app.get("/", {
    preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)],
  }, async (request) => {
    const { page = 1, pageSize = 20, status, q } = request.query as {
      page?: number; pageSize?: number; status?: "active" | "expired" | "inactive"; q?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};
    if (user.role !== "SUPER_ADMIN") {
      where.organizationId = user.organizationId;
    }
    const now = new Date();
    const notExpired = { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] };
    if (status === "active") Object.assign(where, { isActive: true }, notExpired);
    if (status === "inactive") Object.assign(where, { isActive: false }, notExpired);
    if (status === "expired") where.expiresAt = { lt: now };
    if (q) where.code = { contains: q, mode: "insensitive" };

    const [coupons, total] = await Promise.all([
      app.prisma.coupon.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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
    preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)],
  }, async (request, reply) => {
    const coupon = await app.prisma.coupon.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!coupon) return reply.notFound("Coupon not found");
    if (!canAccessCoupon(request, coupon)) return reply.forbidden("Access denied");

    const response: ApiResponse<typeof coupon> = { success: true, data: coupon };
    return response;
  });

  // POST / - Create coupon
  app.post("/", {
    preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)],
  }, async (request, reply) => {
    const body = createCouponSchema.parse(request.body);
    const user = getOrgUser(request);

    // Auto-set organizationId for ORG_ADMIN
    const orgId = user.role === "SUPER_ADMIN" ? (body.organizationId ?? null) : user.organizationId;

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
        title: body.title ?? undefined,
        translations: (body.translations ?? undefined) as Prisma.InputJsonValue | undefined,
        showOnHome: body.showOnHome,
        minOrderAmount: body.minOrderAmount ?? undefined,
        maxDiscount: body.maxDiscount ?? undefined,
        usageLimit: body.usageLimit ?? undefined,
        startsAt: body.startsAt ?? undefined,
        expiresAt: body.expiresAt ?? undefined,
      },
    });
    void translateCoupon(app.prisma, coupon.id, app.log);

    const response: ApiResponse<typeof coupon> = { success: true, data: coupon };
    return response;
  });

  // PUT /:id - Update coupon
  app.put<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)],
  }, async (request, reply) => {
    const body = updateCouponSchema.parse(request.body);

    const existing = await app.prisma.coupon.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Coupon not found");
    if (!canAccessCoupon(request, existing)) return reply.forbidden("Access denied");

    // Check code uniqueness if changing
    if (body.code && body.code !== existing.code) {
      const dup = await app.prisma.coupon.findUnique({ where: { code: body.code } });
      if (dup) return reply.conflict("A coupon with this code already exists");
    }

    const coupon = await app.prisma.coupon.update({
      where: { id: request.params.id },
      data: { ...body, translations: staleTamilDropped(existing, body) },
    });
    void translateCoupon(app.prisma, coupon.id, app.log);

    const response: ApiResponse<typeof coupon> = { success: true, data: coupon };
    return response;
  });

  // DELETE /:id - Delete coupon
  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)],
  }, async (request, reply) => {
    const existing = await app.prisma.coupon.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Coupon not found");
    if (!canAccessCoupon(request, existing)) return reply.forbidden("Access denied");

    await app.prisma.coupon.delete({ where: { id: request.params.id } });
    const response: ApiResponse<{ deleted: boolean }> = { success: true, data: { deleted: true } };
    return response;
  });

  // Advertised coupons a shopper can use at a store; with the cart's amount, which apply now and what's missing
  app.get<{ Querystring: { storeId?: string; orderAmount?: string } }>("/available", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { storeId, orderAmount } = availableCouponsQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({ where: { id: storeId, status: "ACTIVE" }, select: { organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const offers = await couponOffers(app.prisma, { organizationId: store.organizationId, userId: getOrgUser(request).sub, orderAmount });
    return { success: true, data: offers } satisfies ApiResponse<CouponOffer[]>;
  });

  // POST /validate - Validate coupon for checkout
  app.post("/validate", { preHandler: [authenticate] }, async (request, reply) => {
    const body = applyCouponSchema.parse(request.body);
    const user = request.user as { sub: string };
    const code = body.code.toUpperCase();

    const [coupon, store] = await Promise.all([
      app.prisma.coupon.findUnique({ where: { code } }),
      app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } }),
    ]);
    if (!coupon || !store) {
      return reply.status(400).send({ success: false, error: "Invalid Coupon", message: "Coupon not found", statusCode: 400 });
    }
    const check = await checkCoupon(app.prisma, coupon, { userId: user.sub, organizationId: store.organizationId, orderAmount: body.orderAmount });
    if (!check.ok) return reply.status(400).send({ success: false, error: "Invalid Coupon", message: check.reason, statusCode: 400 });
    const discount = check.discount;

    const response: ApiResponse<{ valid: boolean; discount: number; code: string; description: string | null }> = {
      success: true,
      data: { valid: true, discount, code: coupon.code, description: coupon.description },
    };
    return response;
  });
}
