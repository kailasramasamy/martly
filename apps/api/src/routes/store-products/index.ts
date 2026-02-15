import type { FastifyInstance } from "fastify";
import { createStoreProductSchema, updateStoreProductSchema, bulkCreateStoreProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

export async function storeProductRoutes(app: FastifyInstance) {
  // List store-products (paginated, with relations)
  app.get("/", async (request) => {
      const { page = 1, pageSize = 20, q, storeId, productId } = request.query as {
        page?: number; pageSize?: number; q?: string; storeId?: string; productId?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);

      const where: Record<string, unknown> = {};
      if (storeId) where.storeId = storeId;
      if (productId) where.productId = productId;
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
          include: { store: true, product: { include: { brand: true } }, variant: true },
        }),
        app.prisma.storeProduct.count({ where }),
      ]);

      const response: PaginatedResponse<(typeof storeProducts)[0]> = {
        success: true,
        data: storeProducts,
        meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
      };
      return response;
    },
  );

  // Get single store-product
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
      const storeProduct = await app.prisma.storeProduct.findUnique({
        where: { id: request.params.id },
        include: { store: true, product: { include: { brand: true } }, variant: true },
      });
      if (!storeProduct) return reply.notFound("Store product not found");

      const response: ApiResponse<typeof storeProduct> = { success: true, data: storeProduct };
      return response;
    },
  );

  // Create store-product (assign variant to store)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = createStoreProductSchema.parse(request.body);

      // Look up the variant to get productId
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
        },
        include: { store: true, product: { include: { brand: true } }, variant: true },
      });

      const response: ApiResponse<typeof storeProduct> = { success: true, data: storeProduct };
      return response;
    },
  );

  // Bulk create store-products
  app.post(
    "/bulk",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request) => {
      const body = bulkCreateStoreProductSchema.parse(request.body);

      // Look up all variants to get productIds
      const variantIds = body.items.map((i) => i.variantId);
      const variants = await app.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
      });
      const variantMap = new Map(variants.map((v) => [v.id, v.productId]));

      // Check which variants are already assigned
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

  // Update store-product
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = updateStoreProductSchema.parse(request.body);
      const existing = await app.prisma.storeProduct.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store product not found");

      const storeProduct = await app.prisma.storeProduct.update({
        where: { id: request.params.id },
        data: body,
        include: { store: true, product: { include: { brand: true } }, variant: true },
      });

      const response: ApiResponse<typeof storeProduct> = { success: true, data: storeProduct };
      return response;
    },
  );

  // Delete store-product
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.storeProduct.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store product not found");

      await app.prisma.storeProduct.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
