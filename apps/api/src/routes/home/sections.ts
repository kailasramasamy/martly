import type { FastifyInstance } from "fastify";
import { homeDealsQuerySchema, homeSectionsQuerySchema, parseHomeSectionConfig } from "@martly/shared/schemas";
import type { ApiResponse, CategoryDirectoryPage, HomeSectionsPage, PriceBandDealsPage } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { categoryDirectoryPage } from "../../services/home/directory.js";
import { homeSectionsPage } from "../../services/home/page.js";
import { bandPage } from "../../services/home/price-band.js";
import { liveCollection } from "../../services/home/resolvers/collection.js";
import { reviewSummaries, withReviews } from "../../services/store-feed.js";

export async function homeSectionsRoutes(app: FastifyInstance) {
  app.get<{ Params: { storeId: string } }>("/:storeId/sections", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { cursor } = homeSectionsQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({
      where: { id: request.params.storeId, status: "ACTIVE" },
      select: { id: true, organizationId: true, freeDeliveryThreshold: true },
    });
    if (!store) return reply.notFound("Store not found");
    const data = await homeSectionsPage(app.prisma, store, getOrgUser(request).sub, cursor);
    return { success: true, data } satisfies ApiResponse<HomeSectionsPage>;
  });

  app.get<{ Params: { storeId: string } }>("/:storeId/directory", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const store = await app.prisma.store.findFirst({ where: { id: request.params.storeId, status: "ACTIVE" }, select: { id: true, organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const data = await categoryDirectoryPage(app.prisma, store, getOrgUser(request).sub);
    return { success: true, data } satisfies ApiResponse<CategoryDirectoryPage>;
  });

  // Another band or category chip of a price-band deals section
  app.get<{ Params: { storeId: string } }>("/:storeId/deals", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const query = homeDealsQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({ where: { id: request.params.storeId, status: "ACTIVE" }, select: { id: true, organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const section = await app.prisma.homeSection.findFirst({
      where: { id: query.sectionId, organizationId: store.organizationId, type: "PRICE_BAND_DEALS", isActive: true },
      select: { title: true, translations: true, collectionId: true, config: true },
    });
    if (!section) return reply.notFound("Section not found");
    const { bands, headline } = parseHomeSectionConfig("PRICE_BAND_DEALS", section.config) as {
      bands: { label: string; maxPrice: number | null }[]; headline?: string;
    };
    if (query.band >= bands.length) return reply.badRequest("No such band");
    const now = new Date();
    const collection = section.collectionId ? await liveCollection({ prisma: app.prisma, store, userId: "", now }, section.collectionId) : null;
    if (section.collectionId && !collection) return reply.notFound("Section not found");
    const page = await bandPage(app.prisma, {
      storeId: store.id, collectionId: collection?.id ?? null, maxPrice: bands[query.band].maxPrice, categoryId: query.categoryId, now,
    }, query.page);
    const reviews = await reviewSummaries(app.prisma, page.products.map((p) => (p as { productId: string }).productId));
    const data = {
      ...page,
      products: withReviews(page.products, reviews),
      section: {
        title: section.title, headline: headline ?? null, bands: bands.map((b, i) => ({ id: String(i), ...b })),
        translations: section.translations as PriceBandDealsPage["section"]["translations"],
      },
    };
    return { success: true, data } satisfies ApiResponse<PriceBandDealsPage>;
  });
}
