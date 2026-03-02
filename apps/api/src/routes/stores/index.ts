import type { FastifyInstance } from "fastify";
import { createStoreSchema, updateStoreSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { requireOrgContext, orgScopedStoreFilter, getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";
import { haversine } from "../../lib/geo.js";
import { searchProducts } from "../../services/search.js";

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

  // Get nearby stores (public, sorted by distance)
  app.get("/nearby", { preHandler: [authenticateOptional] }, async (request) => {
    const { lat, lng, radius = 10 } = request.query as { lat?: string; lng?: string; radius?: number };

    if (!lat || !lng) {
      return { success: true, data: [] };
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxRadius = Number(radius);

    if (isNaN(userLat) || isNaN(userLng)) {
      return { success: true, data: [] };
    }

    const stores = await app.prisma.store.findMany({
      where: {
        status: "ACTIVE",
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    const nearbyStores = stores
      .map((store) => ({
        ...store,
        distance: haversine(userLat, userLng, store.latitude!, store.longitude!),
      }))
      .filter((s) => s.distance <= maxRadius)
      .sort((a, b) => a.distance - b.distance);

    return { success: true, data: nearbyStores };
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
    const { page = 1, pageSize = 200, isFeatured, hasDiscount, sortBy, q, categoryId, foodType, productId, productIds } = request.query as {
      page?: number; pageSize?: number; isFeatured?: string; hasDiscount?: string;
      sortBy?: string; q?: string; categoryId?: string; foodType?: string; productId?: string; productIds?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
    if (!store) return reply.notFound("Store not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
      return reply.forbidden("Access denied");
    }

    const where: Record<string, unknown> = { storeId: request.params.id, isActive: true };
    let searchMeta: { strategy: string; correctedQuery?: string; expandedTerms?: string[] } | undefined;

    if (productIds) {
      where.productId = { in: productIds.split(",").filter(Boolean) };
    } else if (productId) {
      where.productId = productId;
    }
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
      const searchResult = await searchProducts(app.prisma, q);
      if (searchResult.productIds.length > 0) {
        where.productId = { in: searchResult.productIds };
      } else {
        // Fall back to basic keyword match (may return 0 results)
        where.product = { name: { contains: q, mode: "insensitive" } };
      }
      searchMeta = searchResult.meta;
    }
    if (categoryId) {
      // Collect category + all descendant IDs for hierarchical filtering
      const allCats = await app.prisma.category.findMany({ select: { id: true, parentId: true } });
      const descendantIds = new Set<string>([categoryId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const cat of allCats) {
          if (cat.parentId && descendantIds.has(cat.parentId) && !descendantIds.has(cat.id)) {
            descendantIds.add(cat.id);
            changed = true;
          }
        }
      }
      where.product = { ...(where.product as Record<string, unknown> ?? {}), categoryId: { in: Array.from(descendantIds) } };
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

    // Batch-fetch review aggregates for these products
    const reviewProductIds = [...new Set(storeProducts.map((sp) => sp.productId))];
    const reviewAggs = reviewProductIds.length > 0
      ? await app.prisma.review.groupBy({
          by: ["productId"],
          where: { productId: { in: reviewProductIds }, status: "APPROVED" },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];
    const reviewMap = new Map(reviewAggs.map((r) => [r.productId, { averageRating: Math.round((r._avg.rating ?? 0) * 10) / 10, reviewCount: r._count.rating }]));

    const data = storeProducts.map((sp) => {
      const pricing = calculateEffectivePrice(
        sp.price as unknown as number,
        sp.variant as Parameters<typeof calculateEffectivePrice>[1],
        sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      );
      const variant = formatVariantUnit(sp.variant);
      const reviews = reviewMap.get(sp.productId);
      const product = reviews ? { ...sp.product, averageRating: reviews.averageRating, reviewCount: reviews.reviewCount } : sp.product;
      return { ...sp, product, variant, pricing, availableStock: sp.stock - sp.reservedStock };
    });

    const response: PaginatedResponse<(typeof data)[0]> & { searchMeta?: typeof searchMeta } = {
      success: true,
      data,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    if (searchMeta) response.searchMeta = searchMeta;
    return response;
  });

  // ── Product Substitutes ──────────────────────────────

  app.get<{ Params: { id: string; productId: string } }>(
    "/:id/products/:productId/substitutes",
    { preHandler: [authenticateOptional] },
    async (request, reply) => {
      const { id: storeId, productId } = request.params;

      const store = await app.prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return reply.notFound("Store not found");

      // Load the target product
      const targetSp = await app.prisma.storeProduct.findFirst({
        where: { storeId, productId },
        include: { product: true, variant: true },
      });
      if (!targetSp) return reply.notFound("Product not found in this store");

      const target = targetSp.product;
      const targetPrice = Number(targetSp.price);

      // Build category filter: same category, or parent category if too few results
      let categoryIds: string[] = [];
      if (target.categoryId) {
        categoryIds = [target.categoryId];
        // Also include sibling categories (same parent)
        const category = await app.prisma.category.findUnique({
          where: { id: target.categoryId },
          select: { parentId: true },
        });
        if (category?.parentId) {
          const siblings = await app.prisma.category.findMany({
            where: { parentId: category.parentId },
            select: { id: true },
          });
          categoryIds = siblings.map((c) => c.id);
        }
      }

      // Build substitute query: similar category, same foodType, price within ±50%
      const priceLow = Math.round(targetPrice * 0.5 * 100) / 100;
      const priceHigh = Math.round(targetPrice * 1.5 * 100) / 100;
      const subWhere: Record<string, unknown> = {
        storeId,
        isActive: true,
        stock: { gt: 0 },
        productId: { not: productId },
        price: { gte: priceLow, lte: priceHigh },
        product: {
          isActive: true,
          ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
          ...(target.foodType ? { foodType: target.foodType } : {}),
        },
      };

      const substitutes = await app.prisma.storeProduct.findMany({
        where: subWhere,
        include: {
          product: { include: { category: true, variants: true } },
          variant: true,
        },
        orderBy: [{ price: "asc" }],
        take: 10,
      });

      // Deduplicate by product ID (keep cheapest variant per product)
      const seenProducts = new Set<string>();
      const uniqueSubs = substitutes.filter((sp) => {
        if (seenProducts.has(sp.productId)) return false;
        seenProducts.add(sp.productId);
        return true;
      }).slice(0, 5);

      // Batch-fetch review aggregates
      const reviewProductIds = [...new Set(uniqueSubs.map((sp) => sp.productId))];
      const reviewAggs = reviewProductIds.length > 0
        ? await app.prisma.review.groupBy({
            by: ["productId"],
            where: { productId: { in: reviewProductIds }, status: "APPROVED" },
            _avg: { rating: true },
            _count: { rating: true },
          })
        : [];
      const reviewMap = new Map(reviewAggs.map((r) => [r.productId, { averageRating: Math.round((r._avg.rating ?? 0) * 10) / 10, reviewCount: r._count.rating }]));

      const data = uniqueSubs.map((sp) => {
        const pricing = calculateEffectivePrice(
          sp.price as unknown as number,
          sp.variant as Parameters<typeof calculateEffectivePrice>[1],
          sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
        );
        const variant = formatVariantUnit(sp.variant);
        const reviews = reviewMap.get(sp.productId);
        const product = reviews ? { ...sp.product, averageRating: reviews.averageRating, reviewCount: reviews.reviewCount } : sp.product;
        return { ...sp, product, variant, pricing, availableStock: sp.stock - sp.reservedStock };
      });

      return { success: true, data } satisfies ApiResponse<typeof data>;
    },
  );

  // ── Frequently Bought Together ──────────────────────

  app.get<{ Params: { id: string } }>(
    "/:id/frequently-bought-together",
    { preHandler: [authenticateOptional] },
    async (request, reply) => {
      const storeId = request.params.id;
      const { productIds: productIdsParam, exclude, limit: limitParam } = request.query as {
        productIds?: string; exclude?: string; limit?: string;
      };

      if (!productIdsParam) return reply.badRequest("productIds query parameter is required");

      const productIds = productIdsParam.split(",").filter(Boolean);
      if (productIds.length === 0) return reply.badRequest("At least one productId is required");

      const excludeIds = exclude ? exclude.split(",").filter(Boolean) : [];
      const limit = Math.min(Math.max(Number(limitParam) || 8, 1), 12);

      const store = await app.prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return reply.notFound("Store not found");

      // Raw SQL: find products co-purchased with the given products in DELIVERED orders (last 90 days)
      const coProductIds = await app.prisma.$queryRawUnsafe<{ product_id: string; co_count: number }[]>(
        `
        SELECT oi2.product_id, COUNT(DISTINCT oi1.order_id)::int AS co_count
        FROM order_items oi1
        JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id != oi2.product_id
        JOIN orders o ON o.id = oi1.order_id
        JOIN store_products sp ON sp.store_id = $1 AND sp.product_id = oi2.product_id AND sp.is_active = true AND sp.stock > 0
        WHERE oi1.product_id = ANY($2)
          AND oi2.product_id != ALL($2)
          AND o.store_id = $1
          AND o.status = 'DELIVERED'
          AND o.created_at >= NOW() - INTERVAL '90 days'
          ${excludeIds.length > 0 ? `AND sp.id != ALL($3)` : ""}
        GROUP BY oi2.product_id
        ORDER BY co_count DESC
        LIMIT $${excludeIds.length > 0 ? "4" : "3"}
        `,
        storeId,
        productIds,
        ...(excludeIds.length > 0 ? [excludeIds, limit + 5] : [limit + 5]),
      );

      let resultProductIds = coProductIds.map((r) => r.product_id);

      // Fallback: if too few co-purchase results, supplement with best-sellers
      if (resultProductIds.length < 3) {
        const allExclude = [...productIds, ...resultProductIds];
        const bestSellers = await app.prisma.$queryRawUnsafe<{ product_id: string }[]>(
          `
          SELECT oi.product_id, COUNT(*)::int AS order_count
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          JOIN store_products sp ON sp.store_id = $1 AND sp.product_id = oi.product_id AND sp.is_active = true AND sp.stock > 0
          WHERE o.store_id = $1
            AND o.status = 'DELIVERED'
            AND oi.product_id != ALL($2)
            ${excludeIds.length > 0 ? `AND sp.id != ALL($3)` : ""}
          GROUP BY oi.product_id
          ORDER BY order_count DESC
          LIMIT $${excludeIds.length > 0 ? "4" : "3"}
          `,
          storeId,
          allExclude,
          ...(excludeIds.length > 0 ? [excludeIds, limit + 5 - resultProductIds.length] : [limit + 5 - resultProductIds.length]),
        );
        resultProductIds = [...resultProductIds, ...bestSellers.map((r) => r.product_id)];
      }

      if (resultProductIds.length === 0) {
        return { success: true, data: [] } satisfies ApiResponse<never[]>;
      }

      // Fetch full StoreProduct records via Prisma
      const storeProducts = await app.prisma.storeProduct.findMany({
        where: {
          storeId,
          productId: { in: resultProductIds },
          isActive: true,
          stock: { gt: 0 },
          ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        },
        include: {
          product: { include: { category: true, variants: true } },
          variant: true,
        },
      });

      // Deduplicate by productId — keep the one with highest co-occurrence
      const coCountMap = new Map(coProductIds.map((r) => [r.product_id, r.co_count]));
      const seenProducts = new Set<string>();
      const uniqueProducts = storeProducts
        .sort((a, b) => (coCountMap.get(b.productId) ?? 0) - (coCountMap.get(a.productId) ?? 0))
        .filter((sp) => {
          if (seenProducts.has(sp.productId)) return false;
          seenProducts.add(sp.productId);
          return true;
        })
        .slice(0, limit);

      // Batch-fetch review aggregates
      const reviewProductIds = [...new Set(uniqueProducts.map((sp) => sp.productId))];
      const reviewAggs = reviewProductIds.length > 0
        ? await app.prisma.review.groupBy({
            by: ["productId"],
            where: { productId: { in: reviewProductIds }, status: "APPROVED" },
            _avg: { rating: true },
            _count: { rating: true },
          })
        : [];
      const reviewMap = new Map(reviewAggs.map((r) => [r.productId, { averageRating: Math.round((r._avg.rating ?? 0) * 10) / 10, reviewCount: r._count.rating }]));

      const data = uniqueProducts.map((sp) => {
        const pricing = calculateEffectivePrice(
          sp.price as unknown as number,
          sp.variant as Parameters<typeof calculateEffectivePrice>[1],
          sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
        );
        const variant = formatVariantUnit(sp.variant);
        const reviews = reviewMap.get(sp.productId);
        const product = reviews ? { ...sp.product, averageRating: reviews.averageRating, reviewCount: reviews.reviewCount } : sp.product;
        return { ...sp, product, variant, pricing, availableStock: sp.stock - sp.reservedStock };
      });

      return { success: true, data } satisfies ApiResponse<typeof data>;
    },
  );

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
