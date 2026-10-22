import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/client.js";
import { createStoreSchema, updateStoreSchema, storeProductSearchQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, CategoryFacets, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requirePermission, requireRole } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { requireOrgContext, orgScopedStoreFilter, getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";
import { reviewSummaries, withAllSizes, withReviews } from "../../services/store-feed.js";
import { haversine } from "../../lib/geo.js";
import { drivingDistances } from "../../services/driving-distance.js";
import { searchStoreProducts } from "../../services/store-search.js";
import { decorateStoreProducts, storeProductInclude } from "../../services/store-product-view.js";
import { injectAd, listingAd, type SponsoredAd } from "../../services/sponsored.js";
import { boostedListingPage, hasBoost, markBrandPicks, NO_BOOST, storeBrandBoost, type BrandBoost } from "../../services/brand-boost.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { getStoreDiscoveryInfo } from "../../services/store-discovery.js";
import { catalogCoverage, type CatalogCoverage } from "../../services/catalog-coverage.js";
import { recordOpeningStock } from "../../services/stock-ledger.js";
import { notifyStoreStatusChange, notifyTeamMember } from "../../services/notify/team-alerts.js";
import { categoryFacets, subcategoryIdsUnder } from "../../services/category-browse.js";

/** A sponsored product's listings at the store, in the same shape as the rest of a category page */
async function sponsoredRows(prisma: PrismaClient, storeId: string, productId: string) {
  const rows = await prisma.storeProduct.findMany({ where: { storeId, productId, isActive: true }, include: storeProductInclude, orderBy: { price: "asc" } });
  return decorateStoreProducts(prisma, rows);
}

const CO_PURCHASE_MIN = 3;

export async function storeRoutes(app: FastifyInstance) {
  // List stores (scoped to user's org; guests see all active stores)
  app.get("/", { preHandler: [authenticateOptional] }, async (request) => {
    const { page = 1, pageSize = 20, q, organizationId, status } = request.query as { page?: number; pageSize?: number; q?: string; organizationId?: string; status?: string };
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
    if (status) {
      where.status = status;
    }
    if (q) {
      where.OR = [{ name: { contains: q, mode: "insensitive" as const } }, { address: { contains: q, mode: "insensitive" as const } }];
    }

    const [stores, total] = await Promise.all([
      app.prisma.store.findMany({
        where, skip, take: Number(pageSize), orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: { organization: { select: { name: true, subscriptionEnabled: true } } },
      }),
      app.prisma.store.count({ where }),
    ]);

    const discovery = await getStoreDiscoveryInfo(app.prisma, stores.map((s) => s.id));

    // subscriptionEnabled is true only when both org AND store have it enabled
    const data = stores.map(({ organization, ...store }) => ({
      ...store,
      ...discovery.get(store.id),
      organizationName: organization.name,
      subscriptionEnabled: store.subscriptionEnabled && organization.subscriptionEnabled,
    }));

    const response: PaginatedResponse<(typeof data)[0]> = {
      success: true,
      data,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get store by ID (guests allowed)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const result = await app.prisma.store.findUnique({
      where: { id: request.params.id },
      include: { organization: { select: { subscriptionEnabled: true } } },
    });
    if (!result) return reply.notFound("Store not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, result.id))) {
      return reply.forbidden("Access denied");
    }

    const { organization, ...store } = result;
    const data = {
      ...store,
      subscriptionEnabled: store.subscriptionEnabled && organization.subscriptionEnabled,
    };

    const response: ApiResponse<typeof data> = { success: true, data };
    return response;
  });

  // How much of the catalog this store lists, for staff adding products
  app.get<{ Params: { id: string } }>(
    "/:id/catalog-coverage",
    { preHandler: [authenticate, requirePermission(Permission.LISTING_MANAGE)] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id }, select: { id: true, organizationId: true } });
      if (!store) return reply.notFound("Store not found");
      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) return reply.forbidden("Access denied");
      return { success: true, data: await catalogCoverage(app.prisma, store.id, store.organizationId) } satisfies ApiResponse<CatalogCoverage>;
    },
  );

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
      include: { organization: { select: { subscriptionEnabled: true } } },
    });

    const inRange = stores
      .map((store) => ({ store, distance: haversine(userLat, userLng, store.latitude!, store.longitude!) }))
      .filter((s) => s.distance <= maxRadius);
    const [discovery, tiers, drives] = await Promise.all([
      getStoreDiscoveryInfo(app.prisma, inRange.map((s) => s.store.id)),
      app.prisma.deliveryTier.findMany({
        where: { storeId: { in: inRange.map((s) => s.store.id) }, isActive: true },
        select: { storeId: true, minDistance: true, maxDistance: true },
      }),
      drivingDistances({ lat: userLat, lng: userLng }, inRange.map(({ store }) => ({ id: store.id, lat: store.latitude!, lng: store.longitude! }))),
    ]);
    // Same rule as checkout's delivery lookup: within radius AND an active tier covers the distance
    const hasTier = (storeId: string, distance: number) =>
      tiers.some((t) => t.storeId === storeId && t.minDistance <= distance && t.maxDistance > distance);

    const nearbyStores = inRange
      .map(({ store: { organization, ...store }, distance }) => ({
        ...store,
        ...discovery.get(store.id),
        subscriptionEnabled: store.subscriptionEnabled && organization.subscriptionEnabled,
        distance,
        // Road distance for display; delivery eligibility and fees stay on straight-line distance, as at checkout
        drive: drives.get(store.id) ?? null,
        deliversToYou: distance <= store.deliveryRadius && hasTier(store.id, distance),
      }))
      .sort((a, b) => a.distance - b.distance);

    return { success: true, data: nearbyStores };
  });

  // Create store (force orgId from JWT for non-SUPER_ADMIN)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN"), requireOrgContext] },
    async (request) => {
      const body = createStoreSchema.parse(request.body);
      const user = getOrgUser(request);

      // Non-SUPER_ADMIN: force organizationId from JWT; region decides which brand campaigns reach the store, so only Martly sets it
      if (user.role !== "SUPER_ADMIN") {
        body.organizationId = user.organizationId!;
        body.state = undefined;
        body.district = undefined;
      }

      const store = await app.prisma.store.create({ data: body });

      const response: ApiResponse<typeof store> = { success: true, data: store };
      return response;
    },
  );

  // Update store (verify org access)
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.STORE_SETTINGS)] },
    async (request, reply) => {
      const body = updateStoreSchema.parse(request.body);
      const existing = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.id))) {
        return reply.forbidden("Access denied");
      }

      // Region decides which brand campaigns reach the store, so only Martly sets it
      const { translations, state, district, ...rest } = body;
      if (getOrgUser(request).role === "SUPER_ADMIN") Object.assign(rest, { state, district });
      const store = await app.prisma.store.update({
        where: { id: request.params.id },
        data: { ...rest, ...(translations !== undefined ? { translations: translations ?? Prisma.DbNull } : {}) },
      });

      if (body.status && body.status !== existing.status) {
        void notifyStoreStatusChange(app.fcm, app.prisma, store, existing.status, store.status);
      }

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
    { preHandler: [authenticate, requirePermission(Permission.LISTING_MANAGE)] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!store) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
        return reply.forbidden("Access denied");
      }

      const { variantId, price, stock } = request.body as { variantId: string; price: number; stock: number };

      const variant = await app.prisma.productVariant.findFirst({
        where: { id: variantId, product: { OR: [{ organizationId: null }, { organizationId: store.organizationId }] } },
      });
      if (!variant) return reply.notFound("Product variant not found");

      const existing = await app.prisma.storeProduct.findUnique({
        where: { storeId_variantId: { storeId: request.params.id, variantId } },
      });
      if (existing) return reply.conflict("Variant already assigned to this store");

      const storeProduct = await app.prisma.$transaction(async (tx) => {
        const created = await tx.storeProduct.create({
          data: { storeId: request.params.id, productId: variant.productId, variantId, price, stock },
          include: { product: true, variant: true },
        });
        await recordOpeningStock(tx, [created], request.user.sub);
        return created;
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
    const { page = 1, pageSize = 200, isFeatured, hasDiscount, sortBy, q, categoryId, brandId, foodType, productId, productIds } = request.query as {
      page?: number; pageSize?: number; isFeatured?: string; hasDiscount?: string; sortBy?: string; q?: string;
      categoryId?: string; brandId?: string; foodType?: string; productId?: string; productIds?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
    if (!store) return reply.notFound("Store not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
      return reply.forbidden("Access denied");
    }

    if (q) {
      const parsed = storeProductSearchQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
      const { data, facets, searchMeta } = await searchStoreProducts(app.prisma, store, parsed.data);
      return {
        success: true,
        data,
        meta: { total: data.length, page: 1, pageSize: data.length, totalPages: 1 },
        searchMeta,
        facets,
      };
    }

    const where: Record<string, unknown> = { storeId: request.params.id, isActive: true };

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
    // A plain category listing (no filters or sort the ad would break) carries one sponsored product, second
    let ad: SponsoredAd | null = null;
    // Category listings label the store's own and featured brands, and give them every third slot unless the shopper sorts
    let boost: BrandBoost | null = null;
    if (categoryId) {
      boost = await storeBrandBoost(app.prisma, store.id);
      const subcategoryIds = await subcategoryIdsUnder(app.prisma, categoryId);
      where.product = { ...(where.product as Record<string, unknown> ?? {}), subcategoryId: { in: subcategoryIds } };
      const plain = !hasDiscount && !sortBy && !brandId && !foodType && !productId && !productIds && !isFeatured;
      ad = plain ? await listingAd(app.prisma, store, subcategoryIds) : null;
      // Kept out of the regular results on every page, so it never shows twice
      if (ad) where.productId = { notIn: [ad.productId] };
    }
    if (foodType) {
      where.product = { ...(where.product as Record<string, unknown> ?? {}), foodType };
    }
    if (brandId) {
      where.product = { ...(where.product as Record<string, unknown> ?? {}), brandId };
    }

    let orderBy: Record<string, string> = { createdAt: "desc" };
    if (sortBy === "price_asc") orderBy = { price: "asc" };
    else if (sortBy === "price_desc") orderBy = { price: "desc" };
    else if (sortBy === "newest") orderBy = { createdAt: "desc" };

    // id breaks ties (bulk imports share timestamps and prices) so pages never repeat or skip a listing
    const find = (w: Prisma.StoreProductWhereInput, from: number, take: number) =>
      app.prisma.storeProduct.findMany({ where: w, skip: from, take, include: storeProductInclude, orderBy: [orderBy, { id: "asc" }] });
    const count = (w: Prisma.StoreProductWhereInput) => app.prisma.storeProduct.count({ where: w });
    const listingWhere = where as Prisma.StoreProductWhereInput;
    const { rows: storeProducts, total } = boost && hasBoost(boost) && !sortBy && !brandId
      ? await boostedListingPage(boost, listingWhere, { skip, take: Number(pageSize) }, find, count)
      : await Promise.all([find(listingWhere, skip, Number(pageSize)), count(listingWhere)]).then(([rows, n]) => ({ rows, total: n }));
    const listed = markBrandPicks(await decorateStoreProducts(app.prisma, storeProducts), boost ?? NO_BOOST);
    const data = ad && Number(page) === 1 ? injectAd(listed, await sponsoredRows(app.prisma, store.id, ad.productId), ad) : listed;

    const response: PaginatedResponse<(typeof data)[0]> = {
      success: true,
      data,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Per-subcategory product counts and top brands under a browse node, so category screens can page products
  app.get<{ Params: { id: string }; Querystring: { categoryId?: string } }>(
    "/:id/category-facets", { preHandler: [authenticateOptional] }, async (request, reply) => {
      const { categoryId } = request.query;
      if (!categoryId) return reply.badRequest("categoryId is required");
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id }, select: { id: true } });
      if (!store) return reply.notFound("Store not found");
      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) return reply.forbidden("Access denied");
      const response: ApiResponse<CategoryFacets> = { success: true, data: await categoryFacets(app.prisma, store.id, categoryId) };
      return response;
    },
  );

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

      // Build subcategory filter: same subcategory, or sibling subcategories (same parent category)
      let subcategoryIds: string[] = [];
      if (target.subcategoryId) {
        subcategoryIds = [target.subcategoryId];
        const subcat = await app.prisma.subcategory.findUnique({
          where: { id: target.subcategoryId },
          select: { categoryId: true },
        });
        if (subcat?.categoryId) {
          const siblings = await app.prisma.subcategory.findMany({
            where: { categoryId: subcat.categoryId },
            select: { id: true },
          });
          subcategoryIds = siblings.map((s) => s.id);
        }
      }

      // Build substitute query: similar subcategory, same foodType, price within ±50%
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
          ...(subcategoryIds.length > 0 ? { subcategoryId: { in: subcategoryIds } } : {}),
          ...(target.foodType ? { foodType: target.foodType } : {}),
        },
      };

      const substitutes = await app.prisma.storeProduct.findMany({
        where: subWhere,
        include: {
          product: { include: { subcategory: true, variants: true } },
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
          (sp as unknown as { memberPrice: number | null }).memberPrice,
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

      // Products bought with the given ones in DELIVERED orders (last 90 days). Only real patterns count: a pair seen in
      // CO_PURCHASE_MIN orders from as many different customers, so one shopper's habit or a one-off basket isn't "customers also bought"
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
          ${excludeIds.length > 0 ? `AND sp.id != ALL($4)` : ""}
        GROUP BY oi2.product_id
        HAVING COUNT(DISTINCT oi1.order_id) >= $3 AND COUNT(DISTINCT o.user_id) >= $3
        ORDER BY co_count DESC
        LIMIT ${limit}
        `,
        storeId,
        productIds,
        CO_PURCHASE_MIN,
        ...(excludeIds.length > 0 ? [excludeIds] : []),
      );

      const resultProductIds = coProductIds.map((r) => r.product_id);

      if (resultProductIds.length === 0) {
        return { success: true, data: [] } satisfies ApiResponse<never[]>;
      }

      // Same shape as the home feed: every listed size of each product (the card groups them into a size
      // picker), minus the sizes already in the cart, with review summaries
      const products = [...new Set(resultProductIds)].slice(0, limit).map((productId) => ({ productId }));
      const sizes = (await withAllSizes(app.prisma, storeId, products)).filter((sp) => !excludeIds.includes(sp.id));
      const data = withReviews(sizes, await reviewSummaries(app.prisma, sizes.map((sp) => sp.productId)));

      return { success: true, data } satisfies ApiResponse<typeof data>;
    },
  );

  // ── Store Staff Management ─────────────────────────

  // List staff assigned to a store
  app.get<{ Params: { id: string } }>(
    "/:id/staff",
    { preHandler: [authenticate, requirePermission(Permission.TEAM_MANAGE)] },
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
    { preHandler: [authenticate, requirePermission(Permission.TEAM_MANAGE)] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!store) return reply.notFound("Store not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, store.id))) {
        return reply.forbidden("Access denied");
      }

      const { userId, role } = request.body as { userId: string; role?: string };

      const targetUser = await app.prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return reply.notFound("User not found");

      // Org admins can only assign people who aren't already staff of another organization
      if (getOrgUser(request).role !== "SUPER_ADMIN") {
        const foreignAssignment = await app.prisma.userStore.findFirst({
          where: { userId, store: { organizationId: { not: store.organizationId } } },
        });
        if (foreignAssignment) return reply.forbidden("User belongs to another organization");
      }

      // Only allow assigning STORE_MANAGER, STAFF, or RIDER
      const assignRole = role || targetUser.role;
      if (assignRole !== "STORE_MANAGER" && assignRole !== "STAFF" && assignRole !== "RIDER" && assignRole !== "ORG_ADMIN") {
        return reply.badRequest("Can only assign ORG_ADMIN, STORE_MANAGER, STAFF, or RIDER to stores");
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
          role: assignRole as "STORE_MANAGER" | "STAFF" | "RIDER" | "ORG_ADMIN",
        },
        include: {
          user: { select: { id: true, email: true, name: true, phone: true, role: true } },
        },
      });

      void notifyTeamMember(app.fcm, app.prisma, userId, getOrgUser(request).sub, { kind: "added", storeId: request.params.id });

      const response: ApiResponse<typeof assignment> = { success: true, data: assignment };
      return response;
    },
  );

  // Remove user from store
  app.delete<{ Params: { id: string; userId: string } }>(
    "/:id/staff/:userId",
    { preHandler: [authenticate, requirePermission(Permission.TEAM_MANAGE)] },
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

      void notifyTeamMember(app.fcm, app.prisma, request.params.userId, getOrgUser(request).sub, { kind: "removed", storeId: request.params.id });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
