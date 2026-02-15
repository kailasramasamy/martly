import type { FastifyInstance } from "fastify";
import { createStoreProductSchema, updateStoreProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

export async function storeProductRoutes(app: FastifyInstance) {
  // List store-products (paginated, with relations)
  app.get("/", async (request) => {
      const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
      const skip = (Number(page) - 1) * Number(pageSize);

      const [storeProducts, total] = await Promise.all([
        app.prisma.storeProduct.findMany({
          skip,
          take: Number(pageSize),
          orderBy: { createdAt: "desc" },
          include: { store: true, product: true },
        }),
        app.prisma.storeProduct.count(),
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
        include: { store: true, product: true },
      });
      if (!storeProduct) return reply.notFound("Store product not found");

      const response: ApiResponse<typeof storeProduct> = { success: true, data: storeProduct };
      return response;
    },
  );

  // Create store-product (assign product to store)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = createStoreProductSchema.parse(request.body);

      const existing = await app.prisma.storeProduct.findUnique({
        where: { storeId_productId: { storeId: body.storeId, productId: body.productId } },
      });
      if (existing) return reply.conflict("Product already assigned to this store");

      const storeProduct = await app.prisma.storeProduct.create({
        data: body,
        include: { store: true, product: true },
      });

      const response: ApiResponse<typeof storeProduct> = { success: true, data: storeProduct };
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
        include: { store: true, product: true },
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
