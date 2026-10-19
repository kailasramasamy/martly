import type { FastifyInstance } from "fastify";
import { collectionProductsQuerySchema } from "@martly/shared/schemas";
import type { PaginatedResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { collectionProducts } from "../../services/collection-products.js";
import { liveWindow } from "../../services/store-feed.js";
import { campaignLook } from "../../services/home/campaign-look.js";
import { autoTiles, stockedCollectionItems } from "../../services/home/resolvers/campaign-tiles.js";

export async function collectionStorefrontRoutes(app: FastifyInstance) {
  // The screen a COLLECTION banner or promo push opens
  app.get<{ Params: { id: string } }>("/:id/products", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { storeId, subcategoryIds, q, page, pageSize } = collectionProductsQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({ where: { id: storeId, status: "ACTIVE" }, select: { organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const collection = await app.prisma.collection.findFirst({
      where: {
        id: request.params.id, isActive: true, AND: liveWindow(new Date()),
        OR: [{ organizationId: store.organizationId }, { organizationId: null }],
      },
      select: {
        id: true, title: true, subtitle: true, imageUrl: true, imageUrls: true, textInImage: true, translations: true,
        kind: true, endsAt: true, promo: { select: { discountType: true, discountValue: true } },
      },
    });
    if (!collection) return reply.notFound("This offer has ended");
    const [{ products, total }, campaign, aisles] = await Promise.all([
      collectionProducts(app.prisma, collection.id, storeId, page, pageSize, subcategoryIds, q),
      campaignLook(app.prisma, store.organizationId, collection),
      // The aisle chips only change with stock, so they come with the first page
      page === 1 ? stockedCollectionItems(app.prisma, collection.id, storeId).then((items) => autoTiles(app.prisma, items, true)) : null,
    ]);
    return {
      success: true,
      data: products,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      collection: {
        id: collection.id, title: collection.title, subtitle: collection.subtitle, imageUrl: collection.imageUrl,
        imageUrls: collection.imageUrls, textInImage: collection.textInImage, translations: collection.translations,
        endsAt: collection.endsAt?.toISOString() ?? null,
        // Present when the collection is a campaign in this store's organisation, so its screen matches the Home card
        campaign,
        aisles,
      },
    } satisfies PaginatedResponse<(typeof products)[number]> & { collection: Record<string, unknown> };
  });
}
