import type { FastifyInstance } from "fastify";
import { createStoreSchema, updateStoreSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

export async function storeRoutes(app: FastifyInstance) {
  // List stores
  app.get("/", async (request) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const [stores, total] = await Promise.all([
      app.prisma.store.findMany({ skip, take: Number(pageSize), orderBy: { createdAt: "desc" } }),
      app.prisma.store.count(),
    ]);

    const response: PaginatedResponse<(typeof stores)[0]> = {
      success: true,
      data: stores,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get store by ID
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
    if (!store) return reply.notFound("Store not found");

    const response: ApiResponse<typeof store> = { success: true, data: store };
    return response;
  });

  // Create store (authenticated, admin roles)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const body = createStoreSchema.parse(request.body);
      const store = await app.prisma.store.create({ data: body });

      const response: ApiResponse<typeof store> = { success: true, data: store };
      return response;
    },
  );

  // Update store
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = updateStoreSchema.parse(request.body);
      const existing = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store not found");

      const store = await app.prisma.store.update({
        where: { id: request.params.id },
        data: body,
      });

      const response: ApiResponse<typeof store> = { success: true, data: store };
      return response;
    },
  );

  // Delete store
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Store not found");

      await app.prisma.store.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );

  // Assign product to store (convenience endpoint)
  app.post<{ Params: { id: string } }>(
    "/:id/products",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
      if (!store) return reply.notFound("Store not found");

      const { productId, price, stock } = request.body as { productId: string; price: number; stock: number };

      const existing = await app.prisma.storeProduct.findUnique({
        where: { storeId_productId: { storeId: request.params.id, productId } },
      });
      if (existing) return reply.conflict("Product already assigned to this store");

      const storeProduct = await app.prisma.storeProduct.create({
        data: { storeId: request.params.id, productId, price, stock },
        include: { product: true },
      });

      const response: ApiResponse<typeof storeProduct> = { success: true, data: storeProduct };
      return response;
    },
  );

  // Get store products
  app.get<{ Params: { id: string } }>("/:id/products", async (request, reply) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const store = await app.prisma.store.findUnique({ where: { id: request.params.id } });
    if (!store) return reply.notFound("Store not found");

    const where = { storeId: request.params.id, isActive: true };

    const [storeProducts, total] = await Promise.all([
      app.prisma.storeProduct.findMany({
        where,
        skip,
        take: Number(pageSize),
        include: { product: true },
        orderBy: { createdAt: "desc" },
      }),
      app.prisma.storeProduct.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof storeProducts)[0]> = {
      success: true,
      data: storeProducts,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });
}
