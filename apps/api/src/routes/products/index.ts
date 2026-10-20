import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createProductSchema, updateProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { assertBrandUsable } from "../../services/brands.js";
import { Permission } from "@martly/shared/constants";
import { getOrgUser, getOrgStoreIds } from "../../middleware/org-scope.js";
import type { JwtUser } from "../../types/jwt.js";
import { formatVariantUnit, formatVariantUnits } from "../../services/units.js";
import { searchProductsForAdmin } from "../../services/search.js";
import { fetchRankedPage } from "../../services/ranked-page.js";
import { brandFacets, countIds, inSearchOrder, subcategoryFacets, type SubcategoryFacet } from "../../services/search-facets.js";
import { translateNewProduct } from "../../services/translate/product.js";

  // Shared helper: build visibility + catalogType where clause
  function buildVisibilityFilter(user: { role: string; organizationId?: string | null }, catalogType?: string) {
    const where: Record<string, unknown> = {};
    if (user.role === "SUPER_ADMIN") {
      // SUPER_ADMIN sees all products
    } else if (user.role === "CUSTOMER" || user.role === "GUEST") {
      where.organizationId = null;
      where.isDraft = false;
    } else {
      // Master drafts stay with Super Admin until launched
      where.OR = [{ organizationId: null, isDraft: false }, { organizationId: user.organizationId }];
    }
    if (catalogType === "master") {
      delete where.OR;
      where.organizationId = null;
      if (user.role !== "SUPER_ADMIN") where.isDraft = false;
    } else if (catalogType === "org") {
      delete where.OR;
      // Only SUPER_ADMIN may browse every org's catalog; others see their own org's products (or none)
      if (user.role === "SUPER_ADMIN") where.organizationId = { not: null };
      else if (user.organizationId) where.organizationId = user.organizationId;
      else where.id = { in: [] };
    }
    return where;
  }

  // Format unitType on variants (and nested store-product variants) for API responses
  function formatProductUnits<T extends Record<string, unknown>>(product: T): T {
    const result: Record<string, unknown> = { ...product };
    if (Array.isArray(result.variants)) {
      result.variants = formatVariantUnits(result.variants as { unitType: string }[]);
    }
    if (Array.isArray(result.storeProducts)) {
      result.storeProducts = (result.storeProducts as { variant?: { unitType: string } }[]).map((sp) =>
        sp.variant ? { ...sp, variant: formatVariantUnit(sp.variant) } : sp,
      );
    }
    return result as T;
  }

/** Master products are Super Admin's to change; org products belong to members of that org */
function editDenial(user: JwtUser, product: { organizationId: string | null }): string | null {
  if (product.organizationId === null) return user.role === "SUPER_ADMIN" ? null : "Only Super Admin can edit master catalog products";
  if (user.role === "SUPER_ADMIN") return "Super Admin cannot edit org-specific products";
  return user.organizationId === product.organizationId ? null : "Access denied";
}

export async function productRoutes(app: FastifyInstance) {

  // Product facets — counts by category and productType (guests allowed)
  app.get("/facets", { preHandler: [authenticateOptional] }, async (request) => {
    const { catalogType } = request.query as { catalogType?: string };
    const user = getOrgUser(request);
    const where = buildVisibilityFilter(user, catalogType);

    const [subcategoryGroups, typeGroups, subcategoryList] = await Promise.all([
      app.prisma.product.groupBy({
        by: ["subcategoryId"],
        where: where as Prisma.ProductWhereInput,
        _count: true,
      }),
      app.prisma.product.groupBy({
        by: ["productType"],
        where: where as Prisma.ProductWhereInput,
        _count: true,
      }),
      app.prisma.subcategory.findMany({ select: { id: true, name: true } }),
    ]);

    const subcatNameMap = new Map(subcategoryList.map((c) => [c.id, c.name]));

    return {
      success: true,
      data: {
        subcategories: subcategoryGroups
          .filter((g) => g.subcategoryId != null)
          .map((g) => ({ id: g.subcategoryId!, name: subcatNameMap.get(g.subcategoryId!) ?? "Unknown", count: g._count }))
          .sort((a, b) => b.count - a.count),
        productTypes: typeGroups
          .filter((g) => g.productType != null)
          .map((g) => ({ type: g.productType!, count: g._count }))
          .sort((a, b) => b.count - a.count),
      },
    };
  });

  /**
   * Search candidates plus their subcategory and brand facets. Each facet ignores its own pick (but keeps every
   * other filter) so the chips stay visible for switching between "Liquid", "Powder", "Bar" or between brands.
   */
  async function rankedCandidates(where: Record<string, unknown>) {
    const pickedSub = typeof where.subcategoryId === "string" ? where.subcategoryId : undefined;
    const pickedBrand = typeof where.brandId === "string" ? where.brandId : undefined;
    const rows = await app.prisma.product.findMany({
      where: { ...where, ...(pickedSub ? { subcategoryId: undefined } : {}), ...(pickedBrand ? { brandId: undefined } : {}) },
      select: { id: true, subcategoryId: true, brandId: true },
    });
    const inSub = rows.filter((r) => !pickedSub || r.subcategoryId === pickedSub);
    const inBrand = rows.filter((r) => !pickedBrand || r.brandId === pickedBrand);
    const [subcategories, brands] = await Promise.all([
      subcategoryFacets(app.prisma, countIds(inBrand.map((r) => r.subcategoryId))),
      brandFacets(app.prisma, countIds(inSub.map((r) => r.brandId))),
    ]);
    const candidates = inSub.filter((r) => !pickedBrand || r.brandId === pickedBrand).map((r) => ({ id: r.id, key: r.id }));
    const facets = {
      subcategories: inSearchOrder(subcategories, countIds(rows.map((r) => r.subcategoryId))),
      brands: inSearchOrder(brands, countIds(rows.map((r) => r.brandId))),
    };
    return { candidates, facets };
  }

  /** Facets for an unsearched list (e.g. a brand or subcategory page), counted in SQL; each ignores its own pick */
  async function listFacets(where: Record<string, unknown>) {
    const without = (key: string) => (typeof where[key] === "string" ? { ...where, [key]: undefined } : where);
    const countBy = async (by: "subcategoryId" | "brandId") => {
      const groups = await app.prisma.product.groupBy({ by: [by], where: without(by), _count: { _all: true } });
      return new Map(groups.filter((g) => g[by]).map((g) => [g[by] as string, g._count._all]));
    };
    const [subCounts, brandCounts] = await Promise.all([countBy("subcategoryId"), countBy("brandId")]);
    const [subcategories, brands] = await Promise.all([subcategoryFacets(app.prisma, subCounts), brandFacets(app.prisma, brandCounts)]);
    return { subcategories, brands };
  }

  // List products (guests see master catalog only)
  app.get("/", { preHandler: [authenticateOptional] }, async (request) => {
    const {
      page = 1, pageSize = 20, q, subcategoryId, categoryId, departmentId, brandId, foodType, productType,
      catalogType, scope, hasStoreProducts, includeStoreProducts, organizationId: filterOrgId, withFacets,
    } = request.query as {
      page?: number; pageSize?: number; q?: string; subcategoryId?: string; categoryId?: string;
      departmentId?: string; brandId?: string; foodType?: string; productType?: string; catalogType?: string;
      scope?: string; hasStoreProducts?: string; includeStoreProducts?: string; organizationId?: string; withFacets?: string;
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

    // Same engine as shopper search (whole-word & brand-aware ranking, fuzzy fallback), over the whole catalog
    const ranked = q ? (await searchProductsForAdmin(app.prisma, {}, q)).productIds : undefined;
    if (ranked) where.AND = [...(Array.isArray(where.AND) ? where.AND as unknown[] : []), { id: { in: ranked } }];
    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    } else if (categoryId) {
      const subs = await app.prisma.subcategory.findMany({ where: { categoryId }, select: { id: true } });
      where.subcategoryId = { in: subs.map((s) => s.id) };
    } else if (departmentId) {
      const cats = await app.prisma.category.findMany({ where: { departmentId }, select: { id: true } });
      const subs = await app.prisma.subcategory.findMany({ where: { categoryId: { in: cats.map((c) => c.id) } }, select: { id: true } });
      where.subcategoryId = { in: subs.map((s) => s.id) };
    }
    if (brandId) where.brandId = brandId;
    if (foodType) where.foodType = foodType;
    if (productType) where.productType = productType;
    if (filterOrgId && user.role === "SUPER_ADMIN") where.organizationId = filterOrgId;

    // Build include — optionally include store-products
    const include: Prisma.ProductInclude = { subcategory: { include: { category: { include: { department: true } } } }, brand: true, variants: true, organization: { select: { id: true, name: true } } };
    if (includeStoreProducts === "true") {
      include.storeProducts = {
        ...(orgStoreIds ? { where: { storeId: { in: orgStoreIds } } } : {}),
        include: { store: { select: { id: true, name: true } }, variant: true },
      };
    }

    const search = ranked ? await rankedCandidates(where) : undefined;
    const { rows: products, total } = ranked && search
      ? await fetchRankedPage({
          rankedKeys: ranked,
          candidates: search.candidates,
          fetchRows: (ids) => app.prisma.product.findMany({ where: { id: { in: ids } }, include }),
          skip,
          take: Number(pageSize),
        })
      : await Promise.all([
          app.prisma.product.findMany({ where, skip, take: Number(pageSize), orderBy: [{ createdAt: "desc" }, { id: "asc" }], include }),
          app.prisma.product.count({ where }),
        ]).then(([rows, count]) => ({ rows, total: count }));

    const response: PaginatedResponse<(typeof products)[0]> & { meta: { facets?: { subcategories: SubcategoryFacet[]; brands?: SubcategoryFacet[] } } } = {
      success: true,
      data: products.map(formatProductUnits),
      meta: {
        total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)),
        ...(search
          ? { facets: search.facets }
          : withFacets === "true" ? { facets: await listFacets(where) } : {}),
      },
    };
    return response;
  });

  // Get product by ID (guests can read master products)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const product = await app.prisma.product.findUnique({
      where: { id: request.params.id },
      include: {
        subcategory: { include: { category: { include: { department: true } } } },
        brand: true,
        variants: true,
      },
    });
    if (!product) return reply.notFound("Product not found");

    const user = getOrgUser(request);

    // Master products: anyone can read
    if (product.organizationId === null) {
      const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
      return response;
    }

    // Org products: anyone can read (customers browse products from any org via stores)
    const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
    return response;
  });

  /** List a new org product in the stores the creator works in (optionally narrowed to the requested ones) */
  async function listInStores(
    request: FastifyRequest,
    product: { id: string; variants: { id: string; mrp: Prisma.Decimal | null }[] },
    organizationId: string,
    requestedStoreIds: string[] | undefined,
    isActive: boolean,
  ) {
    const accessible = await getOrgStoreIds(request, app.prisma);
    const stores = await app.prisma.store.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        id: { in: (requestedStoreIds?.length ? requestedStoreIds : accessible ?? []).filter((id) => !accessible || accessible.includes(id)) },
      },
      select: { id: true },
    });
    const data = stores.flatMap((store) =>
      product.variants.map((v) => ({
        storeId: store.id,
        productId: product.id,
        variantId: v.id,
        price: v.mrp != null ? Number(v.mrp) : 0,
        stock: 0,
        isActive,
      })),
    );
    if (data.length > 0) await app.prisma.storeProduct.createMany({ data });
  }

  // Create product with variants (SUPER_ADMIN → master catalog, org members → their org's catalog)
  app.post(
    "/",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_PRODUCTS)] },
    async (request) => {
      const body = createProductSchema.parse(request.body);
      const { variants: variantsInput, nutritionalInfo, organizationId: _bodyOrgId, storeIds: requestedStoreIds, translations, draft, ...productData } = body;
      const user = getOrgUser(request);

      // SUPER_ADMIN: always master catalog (organizationId = null)
      // Org members: force organizationId from JWT
      const organizationId = user.role === "SUPER_ADMIN" ? null : (user.organizationId ?? null);
      await assertBrandUsable(app.prisma, productData.brandId, organizationId);

      const variantsToCreate = variantsInput && variantsInput.length > 0
        ? variantsInput
        : [{ name: "Default", unitType: "PIECE" as const, unitValue: 1 }];

      const product = await app.prisma.product.create({
        data: {
          ...productData,
          organizationId,
          isDraft: draft ?? false,
          nutritionalInfo: nutritionalInfo as Prisma.InputJsonValue | undefined,
          translations: translations as Prisma.InputJsonValue | undefined,
          variants: {
            create: variantsToCreate,
          },
        },
        include: { subcategory: true, brand: true, variants: true },
      });

      if (organizationId) await listInStores(request, product, organizationId, requestedStoreIds, !draft);
      void translateNewProduct(app.prisma, product.id, app.log);

      const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
      return response;
    },
  );

  // Update product (ownership-based auth)
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_PRODUCTS)] },
    async (request, reply) => {
      const { nutritionalInfo, variants, translations, ...rest } = updateProductSchema.parse(request.body);
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Product not found");

      const denied = editDenial(getOrgUser(request), existing);
      if (denied) return reply.forbidden(denied);
      await assertBrandUsable(app.prisma, rest.brandId, existing.organizationId);

      const data: Prisma.ProductUncheckedUpdateInput = {
        ...rest,
        ...(nutritionalInfo !== undefined && {
          nutritionalInfo: nutritionalInfo === null ? Prisma.DbNull : nutritionalInfo as Prisma.InputJsonValue,
        }),
        ...(translations !== undefined && {
          translations: translations === null ? Prisma.DbNull : translations as Prisma.InputJsonValue,
        }),
      };

      const product = await app.prisma.product.update({
        where: { id: request.params.id },
        data,
        include: { subcategory: true, brand: true, variants: true },
      });

      // Update variants if provided
      if (variants && variants.length > 0) {
        for (const v of variants) {
          const { id: variantId, ...variantData } = v;
          if (variantId) {
            const { count } = await app.prisma.productVariant.updateMany({
              where: { id: variantId, productId: request.params.id },
              data: variantData as Prisma.ProductVariantUncheckedUpdateInput,
            });
            if (count === 0) return reply.notFound(`Variant ${variantId} not found on this product`);
          } else {
            await app.prisma.productVariant.create({
              data: { ...variantData, productId: request.params.id } as Prisma.ProductVariantUncheckedCreateInput,
            });
          }
        }
        // Re-fetch with updated variants
        const updated = await app.prisma.product.findUnique({
          where: { id: request.params.id },
          include: { subcategory: true, brand: true, variants: true },
        });
        const response: ApiResponse<typeof updated> = { success: true, data: formatProductUnits(updated!) };
        return response;
      }

      const response: ApiResponse<typeof product> = { success: true, data: formatProductUnits(product) };
      return response;
    },
  );

  // Launch a draft: its store listings go live together
  app.post<{ Params: { id: string } }>(
    "/:id/launch",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_PRODUCTS)] },
    async (request, reply) => {
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id }, select: { organizationId: true, isDraft: true } });
      if (!existing) return reply.notFound("Product not found");
      const denied = editDenial(getOrgUser(request), existing);
      if (denied) return reply.forbidden(denied);
      if (!existing.isDraft) return reply.badRequest("This product is already live");
      const [product] = await app.prisma.$transaction([
        app.prisma.product.update({ where: { id: request.params.id }, data: { isDraft: false } }),
        app.prisma.storeProduct.updateMany({ where: { productId: request.params.id }, data: { isActive: true } }),
      ]);
      const response: ApiResponse<{ id: string; isDraft: boolean }> = { success: true, data: { id: product.id, isDraft: product.isDraft } };
      return response;
    },
  );

  // Delete product (ownership-based auth)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_PRODUCTS)] },
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
        // Org product: only members of that org can delete
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
