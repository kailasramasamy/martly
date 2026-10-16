import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createStoreProductSchema, updateStoreProductSchema, bulkCreateStoreProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { INVENTORY_DUTIES, forbiddenStoreProductFields } from "@martly/shared/permissions";
import { applyMovement, recordOpeningStock } from "../../services/stock-ledger.js";
import { requireOrgContext, getOrgStoreIds, getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";
import { searchProductsForAdmin } from "../../services/search.js";
import { fetchRankedPage } from "../../services/ranked-page.js";
import { countIds, subcategoryFacets, type SubcategoryFacet } from "../../services/search-facets.js";

function withPricing(sp: { stock: number; reservedStock: number; price: unknown; memberPrice?: unknown; discountType: unknown; discountValue: unknown; discountStart: unknown; discountEnd: unknown; variant: { unitType: string; discountType: unknown; discountValue: unknown; discountStart: unknown; discountEnd: unknown } }) {
  const pricing = calculateEffectivePrice(
    sp.price as number,
    sp.variant as Parameters<typeof calculateEffectivePrice>[1],
    sp as Parameters<typeof calculateEffectivePrice>[2],
    sp.memberPrice as number | null | undefined,
  );
  return { ...sp, variant: formatVariantUnit(sp.variant), pricing, availableStock: sp.stock - sp.reservedStock };
}

export async function storeProductRoutes(app: FastifyInstance) {
  const inventoryReaders = requirePermission(...INVENTORY_DUTIES);
  const spInclude = { store: true, product: { include: { brand: true } }, variant: true } as const;

  /** Search candidates (listing → its product for ranking) plus subcategory facets, which ignore the picked subcategory */
  async function rankedListingCandidates(where: Record<string, unknown>, pickedSubcategory: string | undefined) {
    const rows = await app.prisma.storeProduct.findMany({
      where,
      select: { id: true, productId: true, product: { select: { subcategoryId: true } } },
    });
    const facets = await subcategoryFacets(app.prisma, countIds(rows.map((r) => r.product.subcategoryId)));
    const candidates = rows
      .filter((r) => !pickedSubcategory || r.product.subcategoryId === pickedSubcategory)
      .map((r) => ({ id: r.id, key: r.productId }));
    return { candidates, facets };
  }

  // List store-products (scoped to org's stores)
  app.get("/", { preHandler: [authenticate, requireOrgContext, inventoryReaders] }, async (request, reply) => {
      const { page = 1, pageSize = 20, q, storeId, productId, catalogType, stockStatus, organizationId } = request.query as {
        page?: number; pageSize?: number; q?: string; storeId?: string; productId?: string; catalogType?: string;
        stockStatus?: "in_stock" | "low_stock" | "out_of_stock"; organizationId?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);

      const where: Record<string, unknown> = {};

      // Scope to org's stores
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      if (orgStoreIds !== undefined) {
        where.storeId = { in: orgStoreIds };
      }

      // SUPER_ADMIN can filter by organizationId
      if (organizationId && getOrgUser(request).role === "SUPER_ADMIN") {
        const orgStores = await app.prisma.store.findMany({
          where: { organizationId },
          select: { id: true },
        });
        where.storeId = { in: orgStores.map((s: { id: string }) => s.id) };
      }

      if (storeId) {
        if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied");
        where.storeId = storeId;
      }
      if (productId) where.productId = productId;

      const { isFeatured, isActive, subcategoryId } = request.query as { isFeatured?: string; isActive?: string; subcategoryId?: string };
      if (isActive === "true") where.isActive = true;
      else if (isActive === "false") where.isActive = false;
      if (isFeatured === "true") where.isFeatured = true;
      else if (isFeatured === "false") where.isFeatured = false;
      if (catalogType === "master") {
        where.product = { ...(where.product as Record<string, unknown> ?? {}), organizationId: null };
      } else if (catalogType === "org") {
        where.product = { ...(where.product as Record<string, unknown> ?? {}), organizationId: { not: null } };
      }
      // Ranked product search scoped to the store (unlisted included); across stores a store-name match also counts
      const ranked = q ? (await searchProductsForAdmin(app.prisma, { storeId }, q)).productIds : undefined;
      if (q && ranked) {
        where.OR = [
          { productId: { in: ranked } },
          ...(storeId ? [] : [{ store: { name: { contains: q, mode: "insensitive" } } }]),
        ];
      }

      // Stock status filter: use raw SQL to filter by computed available stock
      let stockFilteredIds: string[] | undefined;
      if (stockStatus) {
        const condition =
          stockStatus === "out_of_stock"
            ? "stock - reserved_stock <= 0"
            : stockStatus === "low_stock"
              ? "stock - reserved_stock > 0 AND stock - reserved_stock <= 5"
              : "stock - reserved_stock > 5";

        const scope = where.storeId;
        const scopeIds = typeof scope === "string" ? [scope] : (scope as { in: string[] } | undefined)?.in;
        const rows = scopeIds
          ? await app.prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM store_products WHERE store_id = ANY($1) AND ${condition}`, scopeIds)
          : await app.prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM store_products WHERE ${condition}`);
        stockFilteredIds = rows.map((r) => r.id);
        where.id = { in: stockFilteredIds };
      }

      const search = ranked ? await rankedListingCandidates(where, subcategoryId) : undefined;
      if (subcategoryId && !search) where.product = { ...(where.product as Record<string, unknown> ?? {}), subcategoryId };
      const { rows: storeProducts, total } = ranked && search
        ? await fetchRankedPage({
            rankedKeys: ranked,
            candidates: search.candidates,
            fetchRows: (ids) => app.prisma.storeProduct.findMany({ where: { id: { in: ids } }, include: spInclude }),
            skip,
            take: Number(pageSize),
          })
        : await Promise.all([
            app.prisma.storeProduct.findMany({ where, skip, take: Number(pageSize), orderBy: [{ createdAt: "desc" }, { id: "asc" }], include: spInclude }),
            app.prisma.storeProduct.count({ where }),
          ]).then(([rows, count]) => ({ rows, total: count }));

      const response: PaginatedResponse<ReturnType<typeof withPricing>> & { meta: { facets?: { subcategories: SubcategoryFacet[] } } } = {
        success: true,
        data: storeProducts.map(withPricing),
        meta: {
          total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)),
          ...(search ? { facets: { subcategories: search.facets } } : {}),
        },
      };
      return response;
    },
  );

  // Get single store-product (verify org access)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requireOrgContext, inventoryReaders] }, async (request, reply) => {
      const storeProduct = await app.prisma.storeProduct.findUnique({
        where: { id: request.params.id },
        include: spInclude,
      });
      if (!storeProduct) return reply.notFound("Store product not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, storeProduct.storeId))) {
        return reply.forbidden("Access denied");
      }

      const response: ApiResponse<ReturnType<typeof withPricing>> = { success: true, data: withPricing(storeProduct) };
      return response;
    },
  );

  /** A store may stock master catalog products and its own organization's products only */
  async function usableByStore(storeId: string) {
    const store = await app.prisma.store.findUnique({ where: { id: storeId }, select: { organizationId: true } });
    if (!store) return { id: { in: [] as string[] } };
    return { OR: [{ organizationId: null }, { organizationId: store.organizationId }] };
  }

  // Create store-product (verify store belongs to org)
  app.post(
    "/",
    { preHandler: [authenticate, requirePermission(Permission.LISTING_MANAGE)] },
    async (request, reply) => {
      const body = createStoreProductSchema.parse(request.body);

      // Verify store belongs to user's org
      if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
        return reply.forbidden("Access denied to this store");
      }

      const variant = await app.prisma.productVariant.findFirst({
        where: { id: body.variantId, product: await usableByStore(body.storeId) },
      });
      if (!variant) return reply.notFound("Product variant not found");

      const existing = await app.prisma.storeProduct.findUnique({
        where: { storeId_variantId: { storeId: body.storeId, variantId: body.variantId } },
      });
      if (existing) return reply.conflict("Variant already assigned to this store");

      const storeProduct = await app.prisma.$transaction(async (tx) => {
        const created = await tx.storeProduct.create({
        data: {
          storeId: body.storeId,
          productId: variant.productId,
          variantId: body.variantId,
          price: body.price,
          stock: body.stock,
          discountType: body.discountType ?? undefined,
          discountValue: body.discountValue ?? undefined,
          discountStart: body.discountStart ?? undefined,
          discountEnd: body.discountEnd ?? undefined,
        },
        include: spInclude,
        });
        await recordOpeningStock(tx, [created], request.user.sub);
        return created;
      });

      const response: ApiResponse<ReturnType<typeof withPricing>> = { success: true, data: withPricing(storeProduct) };
      return response;
    },
  );

  // Bulk create store-products (verify store belongs to org)
  app.post(
    "/bulk",
    { preHandler: [authenticate, requirePermission(Permission.LISTING_MANAGE)] },
    async (request, reply) => {
      const body = bulkCreateStoreProductSchema.parse(request.body);

      // Verify store belongs to user's org
      if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
        return reply.forbidden("Access denied to this store");
      }

      const variantIds = body.items.map((i) => i.variantId);
      const variants = await app.prisma.productVariant.findMany({
        where: { id: { in: variantIds }, product: await usableByStore(body.storeId) },
      });
      const variantMap = new Map(variants.map((v) => [v.id, v.productId]));

      const existingAssignments = await app.prisma.storeProduct.findMany({
        where: { storeId: body.storeId, variantId: { in: variantIds } },
        select: { variantId: true },
      });
      const existingSet = new Set(existingAssignments.map((e) => e.variantId));

      const toCreate = body.items
        .filter((item) => !existingSet.has(item.variantId) && variantMap.has(item.variantId))
        .map((item) => ({
          storeId: body.storeId,
          productId: variantMap.get(item.variantId)!,
          variantId: item.variantId,
          price: item.price,
          stock: item.stock,
          discountType: item.discountType ?? undefined,
          discountValue: item.discountValue ?? undefined,
          discountStart: item.discountStart ?? undefined,
          discountEnd: item.discountEnd ?? undefined,
        }));

      let created = 0;
      if (toCreate.length > 0) {
        created = await app.prisma.$transaction(async (tx) => {
          const rows = await tx.storeProduct.createManyAndReturn({ data: toCreate, select: { id: true, storeId: true, stock: true } });
          await recordOpeningStock(tx, rows, request.user.sub);
          return rows.length;
        });
      }

      const response: ApiResponse<{ created: number; skipped: number }> = {
        success: true,
        data: { created, skipped: body.items.length - created },
      };
      return response;
    },
  );

  // Update store-product (verify org access)
  const updateHandler = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = updateStoreProductSchema.parse(request.body);
    const existing = await app.prisma.storeProduct.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Store product not found");
    // Forms resend unchanged fields; only fields whose value actually changes need permission
    const changed = Object.fromEntries(Object.entries(body).filter(([field, value]) =>
      String(value ?? null) !== String((existing as Record<string, unknown>)[field] ?? null)));
    const denied = forbiddenStoreProductFields(request.user, changed);
    if (denied.length > 0) return reply.forbidden(`You can't change: ${denied.join(", ")}`);

    if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
      return reply.forbidden("Access denied");
    }

    const { stock, ...fields } = body;
    const storeProduct = await app.prisma.$transaction(async (tx) => {
      if (stock !== undefined && stock !== existing.stock) {
        await applyMovement(tx, { storeProductId: existing.id, quantity: stock - existing.stock, type: "MANUAL", note: "Stock edited", userId: request.user.sub });
      }
      return tx.storeProduct.update({ where: { id: request.params.id }, data: fields, include: spInclude });
    });

    const response: ApiResponse<ReturnType<typeof withPricing>> = { success: true, data: withPricing(storeProduct) };
    return response;
  };

  // Each changed field is checked against its own permission in the handler
  const updateOpts = { preHandler: [authenticate] };
  app.put<{ Params: { id: string } }>("/:id", updateOpts, updateHandler);
  app.patch<{ Params: { id: string } }>("/:id", updateOpts, updateHandler);

  // Delete store-product (verify org access)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.LISTING_MANAGE)] },
    async (request, reply) => {
      const existing = await app.prisma.storeProduct.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store product not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
        return reply.forbidden("Access denied");
      }

      await app.prisma.storeProduct.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
