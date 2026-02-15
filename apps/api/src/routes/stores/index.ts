import type { FastifyInstance } from "fastify";
import { createStoreSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

export async function storeRoutes(app: FastifyInstance) {
  // List stores
  app.get("/", async (request) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (page - 1) * pageSize;

    const [stores, total] = await Promise.all([
      app.prisma.store.findMany({ skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      app.prisma.store.count(),
    ]);

    const response: PaginatedResponse<typeof stores[0]> = {
      success: true,
      data: stores,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
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

  // Create store (authenticated)
  app.post("/", { preHandler: [authenticate] }, async (request) => {
    const body = createStoreSchema.parse(request.body);
    const store = await app.prisma.store.create({ data: body });

    const response: ApiResponse<typeof store> = { success: true, data: store };
    return response;
  });
}
