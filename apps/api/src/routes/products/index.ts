import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createProductSchema, updateProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds } from "../../middleware/org-scope.js";
import { formatVariantUnit, formatVariantUnits } from "../../services/units.js";

  // Shared helper: build visibility + catalogType where clause
  function buildVisibilityFilter(user: { role: string; organizationId?: string | null }, catalogType?: string) {
    const where: Record<string, unknown> = {};
    if (user.role === "SUPER_ADMIN") {
      // SUPER_ADMIN sees all products
    } else if (user.role === "CUSTOMER" || user.role === "GUEST") {
      where.organizationId = null;
    } else {
      where.OR = [{ organizationId: null }, { organizationId: user.organizationId }];
    }
    if (catalogType === "master") {
      delete where.OR;
      where.organizationId = null;
    } else if (catalogType === "org") {
      if (where.OR) {
        delete where.OR;
        where.organizationId = user.organizationId ?? { not: null };
      } else {
        where.organizationId = { not: null };
      }
    }
    return where;
  }

  // Format unitType on variants (and nested store-product variants) for API responses
  function formatProductUnits<T extends Record<string, unknown>>(product: T): T {
    const result = { ...product };
    if (Array.isArray(result.variants)) {
      result.variants = formatVariantUnits(result.variants as { unitType: string }[]);
    }
    if (Array.isArray(result.storeProducts)) {
      result.storeProducts = (result.storeProducts as { variant?: { unitType: string } }[]).map((sp) =>
        sp.variant ? { ...sp, variant: formatVariantUnit(sp.variant) } : sp,
      );
    }
    return result;
  }

export async function productRoutes(app: FastifyInstance) {

  // Product facets — counts by category and productType (guests allowed)
  app.get("/facets", { preHandler: [authenticateOptional] }, async (request) => {
    const { catalogType } = request.query as { catalogType?: string };
    const user = getOrgUser(request);
    const where = buildVisibilityFilter(user, catalogType);

    const [categoryGroups, typeGroups, categoryList] = await Promise.all([
      app.prisma.product.groupBy({
        by: ["categoryId"],
        where: where as Prisma.ProductWhereInput,
        _count: true,
      }),
      app.prisma.product.groupBy({
        by: ["productType"],
        where: where as Prisma.ProductWhereInput,
        _count: true,
      }),
      app.prisma.category.findMany({ select: { id: true, name: true } }),
    ]);

    const catNameMap = new Map(categoryList.map((c) => [c.id, c.name]));

    return {
      success: true,
      data: {
        categories: categoryGroups
          .filter((g) => g.categoryId != null)
          .map((g) => ({ id: g.categoryId!, name: catNameMap.get(g.categoryId!) ?? "Unknown", count: g._count }))
          .sort((a, b) => b.count - a.count),
        productTypes: typeGroups
          .filter((g) => g.productType != null)
          .map((g) => ({ type: g.productType!, count: g._count }))
          .sort((a, b) => b.count - a.count),
      },
    };
  });

  // List products (guests see master catalog only)
  app.get("/", { preHandler: [authenticateOptional] }, async (request) => {
    const {
      page = 1, pageSize = 20, q, categoryId, brandId, foodType, productType,
      catalogType, scope, hasStoreProducts, includeStoreProducts, organizationId: filterOrgId,
    } = request.query as {
      page?: number; pageSize?: number; q?: string; categoryId?: string;
      brandId?: string; foodType?: string; productType?: string; catalogType?: string;
      scope?: string; hasStoreProducts?: string; includeStoreProducts?: string; organizationId?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    const user = getOrgUser(request);

    // scope=org-relevant skips catalogType (it sets its own visibility)
    const where = buildVisibilityFilter(user, scope === "org-relevant" ? undefined : catalogType);

    // Compute org store IDs once if any store-scoped filter is needed
    const needStoreIds = scope === "org-relevant" || hasStoreProducts === "true" || includeStoreProducts === "true";
    const orgStoreIds = needStoreIds && user.role !== "SUPER_ADMIN"
      ? await getOrgStoreIds(request, app.prisma)
      : undefined;

    // scope=org-relevant: org products + master products mapped to org stores
    if (scope === "org-relevant" && user.role !== "SUPER_ADMIN" && user.role !== "CUSTOMER") {
      const storeFilter = orgStoreIds ? { storeId: { in: orgStoreIds } } : {};
      const mappedIds = await app.prisma.storeProduct.findMany({
        where: { ...storeFilter, product: { organizationId: null } },
        select: { productId: true },
        distinct: ["productId"],
      });
      delete where.OR;
      delete where.organizationId;
      where.OR = [
        { organizationId: user.organizationId },
        { id: { in: mappedIds.map((m) => m.productId) } },
      ];
    }

    // hasStoreProducts: only products that have store-products (in org stores)
    if (hasStoreProducts === "true") {
      const storeFilter = orgStoreIds ? { storeId: { in: orgStoreIds } } : {};
      const spIds = await app.prisma.storeProduct.findMany({
        where: storeFilter,
        select: { productId: true },
        distinct: ["productId"],
      });
      const productIds = spIds.map((s) => s.productId);
      // AND with existing filters
      if (where.OR) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND as unknown[] : []),
          { OR: where.OR },
          { id: { in: productIds } },
        ];
        delete where.OR;
      } else {
        where.id = { in: productIds };
      }
    }

    if (q) {
      const textSearch = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
      ];
      if (where.OR) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND as unknown[] : []),
          { OR: where.OR },
          { OR: textSearch },
        ];
        delete where.OR;
      } else {
        where.OR = textSearch;
      }
    }
    if (categoryId) {
      const allCats = await app.prisma.category.findMany({ select: { id: true, parentId: true } });
      const ids = new Set<string>([categoryId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of allCats) {
          if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
            ids.add(c.id);
            changed = true;
          }
        }
      }
      where.categoryId = ids.size === 1 ? categoryId : { in: Array.from(ids) };
    }
    if (brandId) where.brandId = brandId;
    if (foodType) where.foodType = foodType;
    if (productType) where.productType = productType;
    if (filterOrgId) where.organizationId = filterOrgId;

    // Build include — optionally include store-products
    const include: Prisma.ProductInclude = { category: true, brand: true, variants: true, organization: { select: { id: true, name: true } } };
    if (includeStoreProducts === "true") {
      include.storeProducts = {
        ...(orgStoreIds ? { where: { storeId: { in: orgStoreIds } } } : {}),
        include: { store: { select: { id: true, name: true } }, variant: true },
      };
    }

    const [products, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include,
      }),
      app.prisma.product.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof products)[0]> = {
      success: true,
      data: products.map(formatProductUnits),
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get product by ID (guests can read master products)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const product = await app.prisma.product.findUnique({
      where: { id: request.params.id },
      include: { category: true, brand: true, variants: true },
    });
    if (!product) return reply.notFound("Product not found");

    const user = getOrgUser(request);

    // Master products: anyone can read
    if (product.organizationId === null) {
      const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
      return response;
    }

    // Org products: only that org's users + SUPER_ADMIN
    if (user.role === "SUPER_ADMIN" || user.organizationId === product.organizationId) {
      const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
      return response;
    }

    return reply.forbidden("Access denied");
  });

  // Create product with variants (SUPER_ADMIN → master catalog, ORG_ADMIN → org catalog)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const body = createProductSchema.parse(request.body);
      const { variants: variantsInput, nutritionalInfo, organizationId: _bodyOrgId, storeIds: requestedStoreIds, ...productData } = body;
      const user = getOrgUser(request);

      // SUPER_ADMIN: always master catalog (organizationId = null)
      // ORG_ADMIN: force organizationId from JWT
      const organizationId = user.role === "SUPER_ADMIN" ? null : (user.organizationId ?? null);

      const variantsToCreate = variantsInput && variantsInput.length > 0
        ? variantsInput
        : [{ name: "Default", unitType: "PIECE" as const, unitValue: 1 }];

      const product = await app.prisma.product.create({
        data: {
          ...productData,
          organizationId,
          nutritionalInfo: nutritionalInfo as Prisma.InputJsonValue | undefined,
          variants: {
            create: variantsToCreate,
          },
        },
        include: { category: true, brand: true, variants: true },
      });

      // ORG_ADMIN: auto-assign to stores (all active org stores or specific ones)
      if (user.role === "ORG_ADMIN" && organizationId) {
        let targetStoreIds: string[];
        if (requestedStoreIds && requestedStoreIds.length > 0) {
          // Verify requested stores belong to the org
          const orgStores = await app.prisma.store.findMany({
            where: { id: { in: requestedStoreIds }, organizationId, status: "ACTIVE" },
            select: { id: true },
          });
          targetStoreIds = orgStores.map((s) => s.id);
        } else {
          // Default: all active stores in the org
          const orgStores = await app.prisma.store.findMany({
            where: { organizationId, status: "ACTIVE" },
            select: { id: true },
          });
          targetStoreIds = orgStores.map((s) => s.id);
        }

        if (targetStoreIds.length > 0) {
          const storeProductData = targetStoreIds.flatMap((storeId) =>
            product.variants.map((v) => ({
              storeId,
              productId: product.id,
              variantId: v.id,
              price: v.mrp != null ? Number(v.mrp) : 0,
              stock: 0,
            })),
          );
          await app.prisma.storeProduct.createMany({ data: storeProductData });
        }
      }

      const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
      return response;
    },
  );

  // Update product (ownership-based auth)
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { nutritionalInfo, variants, ...rest } = updateProductSchema.parse(request.body);
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Product not found");

      const user = getOrgUser(request);

      // Ownership check
      if (existing.organizationId === null) {
        // Master product: only SUPER_ADMIN can edit
        if (user.role !== "SUPER_ADMIN") {
          return reply.forbidden("Only Super Admin can edit master catalog products");
        }
      } else {
        // Org product: only ORG_ADMIN of that org can edit
        if (user.role === "SUPER_ADMIN") {
          return reply.forbidden("Super Admin cannot edit org-specific products");
        }
        if (user.organizationId !== existing.organizationId) {
          return reply.forbidden("Access denied");
        }
      }

      const data: Prisma.ProductUncheckedUpdateInput = {
        ...rest,
        ...(nutritionalInfo !== undefined && {
          nutritionalInfo: nutritionalInfo === null ? Prisma.DbNull : nutritionalInfo as Prisma.InputJsonValue,
        }),
      };

      const product = await app.prisma.product.update({
        where: { id: request.params.id },
        data,
        include: { category: true, brand: true, variants: true },
      });

      // Update variants if provided
      if (variants && variants.length > 0) {
        for (const v of variants) {
          const { id: variantId, ...variantData } = v;
          if (variantId) {
            await app.prisma.productVariant.update({
              where: { id: variantId },
              data: variantData as Prisma.ProductVariantUncheckedUpdateInput,
            });
          } else {
            await app.prisma.productVariant.create({
              data: { ...variantData, productId: request.params.id } as Prisma.ProductVariantUncheckedCreateInput,
            });
          }
        }
        // Re-fetch with updated variants
        const updated = await app.prisma.product.findUnique({
          where: { id: request.params.id },
          include: { category: true, brand: true, variants: true },
        });
        const response: ApiResponse<typeof updated> = { success: true, data: formatProductUnits(updated!) };
        return response;
      }

      const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
      return response;
    },
  );

  // Delete product (ownership-based auth)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Product not found");

      const user = getOrgUser(request);

      // Ownership check
      if (existing.organizationId === null) {
        // Master product: only SUPER_ADMIN can delete
        if (user.role !== "SUPER_ADMIN") {
          return reply.forbidden("Only Super Admin can delete master catalog products");
        }
      } else {
        // Org product: only ORG_ADMIN of that org can delete
        if (user.role === "SUPER_ADMIN") {
          return reply.forbidden("Super Admin cannot delete org-specific products");
        }
        if (user.organizationId !== existing.organizationId) {
          return reply.forbidden("Access denied");
        }
      }

      await app.prisma.product.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
