import type { FastifyInstance } from "fastify";
import { festiveTileProductsQuerySchema, searchLandingQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { festiveHeroById, tileProducts } from "../../services/festive-hero.js";

async function findActiveStore(app: FastifyInstance, storeId: string) {
  return app.prisma.store.findFirst({ where: { id: storeId, status: "ACTIVE" }, select: { id: true, organizationId: true } });
}

export async function festiveRoutes(app: FastifyInstance) {
  // The festival screen's header and tile chips, as this store can stock them
  app.get<{ Params: { collectionId: string } }>("/:collectionId", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { storeId } = searchLandingQuerySchema.parse(request.query);
    const store = await findActiveStore(app, storeId);
    if (!store) return reply.notFound("Store not found");
    const hero = await festiveHeroById(app.prisma, store, request.params.collectionId);
    if (!hero) return reply.notFound("Festival not found");
    return { success: true, data: hero } satisfies ApiResponse<typeof hero>;
  });

  app.get<{ Params: { collectionId: string; tileId: string } }>(
    "/:collectionId/tiles/:tileId/products",
    { preHandler: [authenticateOptional] },
    async (request, reply) => {
      const { storeId, page, pageSize } = festiveTileProductsQuerySchema.parse(request.query);
      const store = await findActiveStore(app, storeId);
      if (!store) return reply.notFound("Store not found");
      const tile = await app.prisma.collectionTile.findFirst({
        where: {
          id: request.params.tileId,
          collection: { id: request.params.collectionId, isActive: true, OR: [{ organizationId: store.organizationId }, { organizationId: null }] },
        },
        select: { subcategoryIds: true },
      });
      if (!tile) return reply.notFound("Tile not found");
      const { products, total } = await tileProducts(app.prisma, store.id, tile.subcategoryIds, page, pageSize);
      return {
        success: true,
        data: products,
        meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      } satisfies PaginatedResponse<(typeof products)[number]>;
    },
  );
}
