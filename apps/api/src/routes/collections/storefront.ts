import type { FastifyInstance } from "fastify";
import { collectionProductsQuerySchema } from "@martly/shared/schemas";
import type { PaginatedResponse } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { authenticateOptional } from "../../middleware/auth.js";
import { liveWindow, reviewSummaries, withAllSizes, withReviews } from "../../services/store-feed.js";

/** A collection's products that this store has in stock, in the collection's order. */
async function collectionProducts(prisma: PrismaClient, collectionId: string, storeId: string, page: number, pageSize: number) {
  const ranked = await prisma.$queryRaw<{ id: string; total: number }[]>`
    SELECT ci.product_id AS id, COUNT(*) OVER()::int AS total
    FROM collection_items ci
    JOIN products p ON p.id = ci.product_id AND p.is_active
    WHERE ci.collection_id = ${collectionId}
      AND EXISTS (SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active AND sp.stock > 0)
    ORDER BY ci.sort_order, ci.product_id
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  const products = await withAllSizes(prisma, storeId, ranked.map((r) => ({ productId: r.id })));
  const reviews = await reviewSummaries(prisma, ranked.map((r) => r.id));
  return { products: withReviews(products, reviews), total: ranked[0]?.total ?? 0 };
}

export async function collectionStorefrontRoutes(app: FastifyInstance) {
  // The screen a COLLECTION banner or promo push opens
  app.get<{ Params: { id: string } }>("/:id/products", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { storeId, page, pageSize } = collectionProductsQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({ where: { id: storeId, status: "ACTIVE" }, select: { organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const collection = await app.prisma.collection.findFirst({
      where: {
        id: request.params.id, isActive: true, AND: liveWindow(new Date()),
        OR: [{ organizationId: store.organizationId }, { organizationId: null }],
      },
      select: { id: true, title: true, subtitle: true, imageUrl: true, imageUrls: true, textInImage: true, translations: true },
    });
    if (!collection) return reply.notFound("This offer has ended");
    const { products, total } = await collectionProducts(app.prisma, collection.id, storeId, page, pageSize);
    return {
      success: true,
      data: products,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      collection,
    } satisfies PaginatedResponse<(typeof products)[number]> & { collection: typeof collection };
  });
}
