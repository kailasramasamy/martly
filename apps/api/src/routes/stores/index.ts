import type { FastifyInstance } from "fastify";
import { createStoreSchema, updateStoreSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { requireOrgContext, orgScopedStoreFilter, getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";

export async function storeRoutes(app: FastifyInstance) {
  // List stores (scoped to user's org; guests see all active stores)
  app.get("/", { preHandler: [authenticateOptional] }, async (request) => {
    const { page = 1, pageSize = 20, q, organizationId } = request.query as { page?: number; pageSize?: number; q?: string; organizationId?: string };
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Record<string, unknown> = {};
    const orgStoreIds = await getOrgStoreIds(request, app.prisma);
    if (orgStoreIds !== undefined) {
      where.id = { in: orgStoreIds };
    }
    // SUPER_ADMIN can filter by organizationId
    if (organizationId && getOrgUser(request).role === "SUPER_ADMIN") {
      where.organizationId = organizationId;
    }
    if (q) {
      where.OR = [{ name: { contains: q, mode: "insensitive" as const } }, { address: { contains: q, mode: "insensitive" as const } }];
    }

    const [stores, total] = await Promise.all([
      app.prisma.store.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: "desc" } }),
      app.prisma.store.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof stores)[0]> = {
      success: true,
      data: stores,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get store by ID (guests allowed)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
    if (!store) return reply.notFound("Store not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
      return reply.forbidden("Access denied");
    }

    const response: ApiResponse<typeof store> = { success: true, data: store };
    return response;
  });

  // Create store (force orgId from JWT for non-SUPER_ADMIN)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const body = createStoreSchema.parse(request.body);
      const user = getOrgUser(request);

      // Non-SUPER_ADMIN: force organizationId from JWT
      if (user.role !== "SUPER_ADMIN" && user.organizationId) {
        body.organizationId = user.organizationId;
      }

      const store = await app.prisma.store.create({ data: body });

      const response: ApiResponse<typeof store> = { success: true, data: store };
      return response;
    },
  );

  // Update store (verify org access)
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = updateStoreSchema.parse(request.body);
      const existing = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.id))) {
        return reply.forbidden("Access denied");
      }

      const store = await app.prisma.store.update({
        where: { id: request.params.id },
        data: body,
      });

      const response: ApiResponse<typeof store> = { success: true, data: store };
      return response;
    },
  );

  // Delete store (verify org access)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.id))) {
        return reply.forbidden("Access denied");
      }

      await app.prisma.store.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );

  // Assign variant to store (verify org access)
  app.post<{ Params: { id: string } }>(
    "/:id/products",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!store) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
        return reply.forbidden("Access denied");
      }

      const { variantId, price, stock } = request.body as { variantId: string; price: number; stock: number };

      const variant = await app.prisma.productVariant.findUnique({ where: { id: variantId } });
      if (!variant) return reply.notFound("Product variant not found");

      const existing = await app.prisma.storeProduct.findUnique({
        where: { storeId_variantId: { storeId: request.params.id, variantId } },
      });
      if (existing) return reply.conflict("Variant already assigned to this store");

      const storeProduct = await app.prisma.storeProduct.create({
        data: { storeId: request.params.id, productId: variant.productId, variantId, price, stock },
        include: { product: true, variant: true },
      });

      const response: ApiResponse<typeof storeProduct> = {
        success: true,
        data: { ...storeProduct, variant: formatVariantUnit(storeProduct.variant) },
      };
      return response;
    },
  );

  // Get store products (guests allowed)
  app.get<{ Params: { id: string } }>("/:id/products", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { page = 1, pageSize = 200, isFeatured, hasDiscount, sortBy, q, categoryId, foodType } = request.query as {
      page?: number; pageSize?: number; isFeatured?: string; hasDiscount?: string;
      sortBy?: string; q?: string; categoryId?: string; foodType?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
    if (!store) return reply.notFound("Store not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
      return reply.forbidden("Access denied");
    }

    const where: Record<string, unknown> = { storeId: request.params.id, isActive: true };
    if (isFeatured === "true") {
      where.isFeatured = true;
    }
    if (hasDiscount === "true") {
      const now = new Date();
      where.discountType = { not: null };
      where.discountValue = { gt: 0 };
      where.OR = [
        { discountStart: null, discountEnd: null },
        { discountStart: { lte: now }, discountEnd: null },
        { discountStart: null, discountEnd: { gte: now } },
        { discountStart: { lte: now }, discountEnd: { gte: now } },
      ];
    }
    if (q) {
      where.product = { name: { contains: q, mode: "insensitive" } };
    }
    if (categoryId) {
      where.product = { ...(where.product as Record<string, unknown> ?? {}), categoryId };
    }
    if (foodType) {
      where.product = { ...(where.product as Record<string, unknown> ?? {}), foodType };
    }

    let orderBy: Record<string, string> = { createdAt: "desc" };
    if (sortBy === "price_asc") orderBy = { price: "asc" };
    else if (sortBy === "price_desc") orderBy = { price: "desc" };
    else if (sortBy === "newest") orderBy = { createdAt: "desc" };

    const [storeProducts, total] = await Promise.all([
      app.prisma.storeProduct.findMany({
        where,
        skip,
        take: Number(pageSize),
        include: {
          product: { include: { category: true, variants: true } },
          variant: true,
        },
        orderBy,
      }),
      app.prisma.storeProduct.count({ where }),
    ]);

    const data = storeProducts.map((sp) => {
      const pricing = calculateEffectivePrice(
        sp.price as unknown as number,
        sp.variant as Parameters<typeof calculateEffectivePrice>[1],
        sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      );
      const variant = formatVariantUnit(sp.variant);
      return { ...sp, variant, pricing, availableStock: sp.stock - sp.reservedStock };
    });

    const response: PaginatedResponse<(typeof data)[0]> = {
      success: true,
      data,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // ── Store Staff Management ─────────────────────────

  // List staff assigned to a store
  app.get<{ Params: { id: string } }>(
    "/:id/staff",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!store) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
        return reply.forbidden("Access denied");
      }

      const assignments = await app.prisma.userStore.findMany({
        where: { storeId: request.params.id },
        include: {
          user: { select: { id: true, email: true, name: true, phone: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const data = assignments.map((a) => ({
        id: a.id,
        userId: a.userId,
        storeId: a.storeId,
        role: a.role,
        createdAt: a.createdAt,
        user: a.user,
      }));

      const response: ApiResponse<typeof data> = { success: true, data };
      return response;
    },
  );

  // Assign user to store
  app.post<{ Params: { id: string } }>(
    "/:id/staff",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!store) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
        return reply.forbidden("Access denied");
      }

      const { userId, role } = request.body as { userId: string; role?: string };

      const targetUser = await app.prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return reply.notFound("User not found");

      // Only allow assigning STORE_MANAGER or STAFF
      const assignRole = role || targetUser.role;
      if (assignRole !== "STORE_MANAGER" && assignRole !== "STAFF" && assignRole !== "ORG_ADMIN") {
        return reply.badRequest("Can only assign ORG_ADMIN, STORE_MANAGER, or STAFF to stores");
      }

      // Check if already assigned
      const existing = await app.prisma.userStore.findUnique({
        where: { userId_storeId: { userId, storeId: request.params.id } },
      });
      if (existing) return reply.conflict("User is already assigned to this store");

      const assignment = await app.prisma.userStore.create({
        data: {
          userId,
          storeId: request.params.id,
          role: assignRole as "STORE_MANAGER" | "STAFF" | "ORG_ADMIN",
        },
        include: {
          user: { select: { id: true, email: true, name: true, phone: true, role: true } },
        },
      });

      const response: ApiResponse<typeof assignment> = { success: true, data: assignment };
      return response;
    },
  );

  // Remove user from store
  app.delete<{ Params: { id: string; userId: string } }>(
    "/:id/staff/:userId",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!store) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
        return reply.forbidden("Access denied");
      }

      const assignment = await app.prisma.userStore.findUnique({
        where: { userId_storeId: { userId: request.params.userId, storeId: request.params.id } },
      });
      if (!assignment) return reply.notFound("User is not assigned to this store");

      await app.prisma.userStore.delete({
        where: { userId_storeId: { userId: request.params.userId, storeId: request.params.id } },
      });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
