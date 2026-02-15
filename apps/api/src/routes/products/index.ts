import type { FastifyInstance } from "fastify";
import { createProductSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

export async function productRoutes(app: FastifyInstance) {
  // List products
  app.get("/", async (request) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (page - 1) * pageSize;

    const [products, total] = await Promise.all([
      app.prisma.product.findMany({ skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      app.prisma.product.count(),
    ]);

    const response: PaginatedResponse<typeof products[0]> = {
      success: true,
      data: products,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
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

  // Create product (authenticated)
  app.post("/", { preHandler: [authenticate] }, async (request) => {
    const body = createProductSchema.parse(request.body);
    const product = await app.prisma.product.create({ data: body });

    const response: ApiResponse<typeof product> = { success: true, data: product };
    return response;
  });
}
