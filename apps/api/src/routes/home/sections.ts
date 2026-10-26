import type { FastifyInstance } from "fastify";
import { buyGetQuerySchema, homeDealsQuerySchema, homeSectionsQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, CategoryDirectoryPage, HomeSectionsPage, PriceBandDealsPage, PriceBandPage } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { MOST_BOUGHT_LIST } from "@martly/shared/constants";
import { buyGetPage } from "../../services/home/buy-get.js";
import { mostBought } from "../../services/home/most-bought.js";
import { categoryDirectoryPage } from "../../services/home/directory.js";
import { homeSectionsPage } from "../../services/home/page.js";
import { bandPage, dealsSection } from "../../services/home/price-band.js";
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

  // The full buy X get Y list, a page and category chip at a time; same shape as a price band's page
  app.get<{ Params: { storeId: string } }>("/:storeId/buy-get", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const query = buyGetQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({ where: { id: request.params.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");
    const page = await buyGetPage(app.prisma, { storeId: store.id, ...query, now: new Date() });
    const reviews = await reviewSummaries(app.prisma, page.products.map((p) => (p as { productId: string }).productId));
    const data = { ...page, products: withReviews(page.products, reviews) };
    return { success: true, data } satisfies ApiResponse<PriceBandPage>;
  });

  // The store's best sellers over 30 days, for the most-bought hero card's "View all"
  app.get<{ Params: { storeId: string } }>("/:storeId/most-bought", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const store = await app.prisma.store.findFirst({ where: { id: request.params.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");
    const products = await mostBought(app.prisma, store.id, MOST_BOUGHT_LIST);
    const reviews = await reviewSummaries(app.prisma, products.map((p) => p.productId as string));
    return { success: true, data: withReviews(products, reviews) } satisfies ApiResponse<unknown[]>;
  });

  // Another band or category chip of a price-band deals section
  app.get<{ Params: { storeId: string } }>("/:storeId/deals", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const query = homeDealsQuerySchema.parse(request.query);
    const store = await app.prisma.store.findFirst({ where: { id: request.params.storeId, status: "ACTIVE" }, select: { id: true, organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const now = new Date();
    const deals = await dealsSection(app.prisma, store, query.sectionId, now);
    if (!deals) return reply.notFound("Section not found");
    if (query.band >= deals.bands.length) return reply.badRequest("No such band");
    const page = await bandPage(app.prisma, {
      storeId: store.id, collectionId: deals.collectionId, maxPrice: deals.bands[query.band].maxPrice, categoryId: query.categoryId, now,
    }, query.page);
    const reviews = await reviewSummaries(app.prisma, page.products.map((p) => (p as { productId: string }).productId));
    const { collectionId: _, ...section } = deals;
    const data = { ...page, products: withReviews(page.products, reviews), section };
    return { success: true, data } satisfies ApiResponse<PriceBandDealsPage>;
  });
}
