import type { FastifyInstance } from "fastify";
import { createStoreProductSchema, updateStoreProductSchema, bulkCreateStoreProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { requireOrgContext, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";

function withPricing(sp: { stock: number; reservedStock: number; price: unknown; discountType: unknown; discountValue: unknown; discountStart: unknown; discountEnd: unknown; variant: { discountType: unknown; discountValue: unknown; discountStart: unknown; discountEnd: unknown } }) {
  const pricing = calculateEffectivePrice(
    sp.price as number,
    sp.variant as Parameters<typeof calculateEffectivePrice>[1],
    sp as Parameters<typeof calculateEffectivePrice>[2],
  );
  return { ...sp, pricing, availableStock: sp.stock - sp.reservedStock };
}

export async function storeProductRoutes(app: FastifyInstance) {
  const spInclude = { store: true, product: { include: { brand: true } }, variant: true } as const;

  // List store-products (scoped to org's stores)
  app.get("/", { preHandler: [authenticate, requireOrgContext] }, async (request) => {
      const { page = 1, pageSize = 20, q, storeId, productId, catalogType } = request.query as {
        page?: number; pageSize?: number; q?: string; storeId?: string; productId?: string; catalogType?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);

      const where: Record<string, unknown> = {};

      // Scope to org's stores
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      if (orgStoreIds !== undefined) {
        where.storeId = { in: orgStoreIds };
      }

      if (storeId) where.storeId = storeId;
      if (productId) where.productId = productId;
      if (catalogType === "master") {
        where.product = { ...(where.product as Record<string, unknown> ?? {}), organizationId: null };
      } else if (catalogType === "org") {
        where.product = { ...(where.product as Record<string, unknown> ?? {}), organizationId: { not: null } };
      }
      if (q) {
        where.OR = [
          { store: { name: { contains: q, mode: "insensitive" } } },
          { product: { name: { contains: q, mode: "insensitive" } } },
        ];
      }

      const [storeProducts, total] = await Promise.all([
        app.prisma.storeProduct.findMany({
          where,
          skip,
          take: Number(pageSize),
          orderBy: { createdAt: "desc" },
          include: spInclude,
        }),
        app.prisma.storeProduct.count({ where }),
      ]);

      const response: PaginatedResponse<ReturnType<typeof withPricing>> = {
        success: true,
        data: storeProducts.map(withPricing),
        meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
      };
      return response;
    },
  );

  // Get single store-product (verify org access)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
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

  // Create store-product (verify store belongs to org)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = createStoreProductSchema.parse(request.body);

      // Verify store belongs to user's org
      if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
        return reply.forbidden("Access denied to this store");
      }

      const variant = await app.prisma.productVariant.findUnique({ where: { id: body.variantId } });
      if (!variant) return reply.notFound("Product variant not found");

      const existing = await app.prisma.storeProduct.findUnique({
        where: { storeId_variantId: { storeId: body.storeId, variantId: body.variantId } },
      });
      if (existing) return reply.conflict("Variant already assigned to this store");

      const storeProduct = await app.prisma.storeProduct.create({
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

      const response: ApiResponse<ReturnType<typeof withPricing>> = { success: true, data: withPricing(storeProduct) };
      return response;
    },
  );

  // Bulk create store-products (verify store belongs to org)
  app.post(
    "/bulk",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = bulkCreateStoreProductSchema.parse(request.body);

      // Verify store belongs to user's org
      if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
        return reply.forbidden("Access denied to this store");
      }

      const variantIds = body.items.map((i) => i.variantId);
      const variants = await app.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
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
        const result = await app.prisma.storeProduct.createMany({ data: toCreate });
        created = result.count;
      }

      const response: ApiResponse<{ created: number; skipped: number }> = {
        success: true,
        data: { created, skipped: body.items.length - created },
      };
      return response;
    },
  );

  // Update store-product (verify org access)
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = updateStoreProductSchema.parse(request.body);
      const existing = await app.prisma.storeProduct.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store product not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
        return reply.forbidden("Access denied");
      }

      const storeProduct = await app.prisma.storeProduct.update({
        where: { id: request.params.id },
        data: body,
        include: spInclude,
      });

      const response: ApiResponse<ReturnType<typeof withPricing>> = { success: true, data: withPricing(storeProduct) };
      return response;
    },
  );

  // Delete store-product (verify org access)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
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
