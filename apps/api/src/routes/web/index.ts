import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { webShopQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, WebHome, WebStorePage, WebTownPage } from "@martly/shared/types";
import { storeBrands } from "../../services/brands.js";
import { shopStore, type ShopContext } from "../../services/web-shop/cards.js";
import { webSearch, webSearchLanding, webSuggestions } from "../../services/web-shop/search.js";
import { webHomeSections } from "../../services/web-shop/home-sections.js";
import { storeProfile } from "../../services/web-shop/store-profile.js";
import { liveStore, townPage, webStoreSelect } from "../../services/web-shop/town-page.js";
import { bestSellers, brandPage, brandsPage, buyGetList, collectionPage, dealsList } from "../../services/web-shop/lists.js";
import { webSearchLogRoutes } from "./search-log.js";
import { categoryPage, departmentPage, productPage, sitemap, storeDepartments } from "../../services/web-shop/pages.js";


/** Public data for martlyshop.in, the website shoppers land on before they have an account */
export async function webRoutes(app: FastifyInstance) {
  // Live towns are the ones with at least one launched store; the Martly Template org never shows
  app.get("/home", async (_request, reply) => {
    const towns = await app.prisma.town.findMany({
      where: { stores: { some: liveStore } },
      orderBy: { name: "asc" },
      select: {
        name: true,
        slug: true,
        district: true,
        state: true,
        stores: {
          where: liveStore,
          orderBy: [{ launchedAt: "asc" }, { name: "asc" }],
          select: webStoreSelect,
        },
      },
    });
    reply.header("Cache-Control", "public, max-age=300");
    return { success: true, data: { towns } } satisfies ApiResponse<WebHome>;
  });

  // A town's page at martlyshop.in/{town}: its live stores and what ordering from each is like
  app.get<{ Params: { town: string } }>("/towns/:town", async (request, reply) => {
    const page = await townPage(app.prisma, request.params.town);
    if (!page) return reply.notFound("Town not found");
    reply.header("Cache-Control", "public, max-age=60");
    return { success: true, data: page } satisfies ApiResponse<WebTownPage>;
  });

  // A store's page at martlyshop.in/{town}/{store}
  app.get<{ Params: { town: string; store: string } }>("/stores/:town/:store", async (request, reply) => {
    const store = await app.prisma.store.findFirst({
      where: { ...liveStore, slug: request.params.store, town: { slug: request.params.town } },
      select: { ...webStoreSelect, town: { select: { name: true, slug: true, district: true, state: true } } },
    });
    if (!store) return reply.notFound("Store not found");
    const { town, ...rest } = store;
    reply.header("Cache-Control", "public, max-age=300");
    return { success: true, data: { store: rest, town } } satisfies ApiResponse<WebStorePage>;
  });

  shopRoutes(app);
  webSearchLogRoutes(app);
}

const BRAND_RAIL = 12;

/**
 * The shop pages, priced at the shopper's store (?store=, from the site's cookie) or the one picked for them.
 * Prices change, so these cache for a minute; a page the store can't fill is a 404.
 */
function shopRoutes(app: FastifyInstance) {
  const respond = async <T>(request: FastifyRequest, reply: FastifyReply, build: (ctx: ShopContext, q: ReturnType<typeof webShopQuerySchema.parse>) => Promise<T | null>) => {
    const query = webShopQuerySchema.parse(request.query);
    const ctx = await shopStore(app.prisma, query);
    if (!ctx) return reply.notFound("No store is live yet");
    const data = await build(ctx, query);
    if (!data) return reply.notFound("Not found");
    reply.header("Cache-Control", "public, max-age=60");
    return { success: true, data } satisfies ApiResponse<T>;
  };

  // The app's Home sections, a page at a time
  app.get("/home-sections", (request, reply) => respond(request, reply, async ({ store, organizationId }, q) => ({
    store,
    profile: q.cursor ? null : await storeProfile(app.prisma, store.id),
    ...await webHomeSections(app.prisma, store, organizationId, q.cursor, () => storeBrands(app.prisma, store.id, BRAND_RAIL)),
  })));

  app.get<{ Params: { slug: string } }>("/collections/:slug", (request, reply) =>
    respond(request, reply, (ctx, q) => collectionPage(app.prisma, ctx, request.params.slug, q)));

  app.get("/brands", (request, reply) => respond(request, reply, (ctx) => brandsPage(app.prisma, ctx)));

  app.get<{ Params: { slug: string } }>("/brands/:slug", (request, reply) =>
    respond(request, reply, (ctx, q) => brandPage(app.prisma, ctx, request.params.slug, q)));

  app.get("/offers/buy-get", (request, reply) => respond(request, reply, (ctx, q) => buyGetList(app.prisma, ctx, q)));

  app.get("/best-sellers", (request, reply) => respond(request, reply, (ctx) => bestSellers(app.prisma, ctx)));

  app.get<{ Params: { sectionId: string } }>("/deals/:sectionId", (request, reply) =>
    respond(request, reply, (ctx, q) => dealsList(app.prisma, ctx, request.params.sectionId, q)));

  // The departments the store stocks, for the department bar on every page
  app.get("/departments", (request, reply) => respond(request, reply, ({ store }) => storeDepartments(app.prisma, store.id)));

  app.get<{ Params: { department: string } }>("/departments/:department", (request, reply) =>
    respond(request, reply, ({ store }) => departmentPage(app.prisma, store, request.params.department)));

  app.get<{ Params: { department: string; category: string } }>("/departments/:department/:category", (request, reply) =>
    respond(request, reply, ({ store }, q) => categoryPage(app.prisma, store, request.params, q)));

  app.get<{ Params: { slug: string } }>("/products/:slug", (request, reply) =>
    respond(request, reply, ({ store }) => productPage(app.prisma, store, request.params.slug)));

  app.get("/search", (request, reply) => respond(request, reply, (ctx, q) => webSearch(app.prisma, ctx, q)));

  app.get("/search/suggest", (request, reply) => respond(request, reply, (ctx, q) => webSuggestions(app.prisma, ctx, q.q ?? "")));

  app.get("/search/landing", (request, reply) => respond(request, reply, (ctx) => webSearchLanding(app.prisma, ctx)));

  app.get("/sitemap", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=3600");
    return { success: true, data: await sitemap(app.prisma) };
  });
}
