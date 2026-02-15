import type { FastifyInstance } from "fastify";
import { createProductSchema, updateProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

export async function productRoutes(app: FastifyInstance) {
  // List products
  app.get("/", async (request) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);

    const [products, total] = await Promise.all([
      app.prisma.product.findMany({ skip, take: Number(pageSize), orderBy: { createdAt: "desc" } }),
      app.prisma.product.count(),
    ]);

    const response: PaginatedResponse<(typeof products)[0]> = {
      success: true,
      data: products,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get product by ID
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const product = await app.prisma.product.findUnique({ where: { id: request.params.id } });
    if (!product) return reply.notFound("Product not found");

    const response: ApiResponse<typeof product> = { success: true, data: product };
    return response;
  });

  // Create product (authenticated, admin roles)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const body = createProductSchema.parse(request.body);
      const product = await app.prisma.product.create({ data: body });

      const response: ApiResponse<typeof product> = { success: true, data: product };
      return response;
    },
  );

  // Update product
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = updateProductSchema.parse(request.body);
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Product not found");

      const product = await app.prisma.product.update({
        where: { id: request.params.id },
        data: body,
      });

      const response: ApiResponse<typeof product> = { success: true, data: product };
      return response;
    },
  );

  // Delete product
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const existing = await app.prisma.product.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Product not found");

      await app.prisma.product.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
