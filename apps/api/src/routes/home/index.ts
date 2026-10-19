import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { getTimePeriod, TIME_CATEGORY_MAP, type TimePeriod } from "../../services/time-picks.js";
import {
  buildProductData, enrichStoreProduct, liveWindow, reviewSummaries, withAllSizes, withReviews,
} from "../../services/store-feed.js";
import { activeDealRows, buyAgainProducts, pastOrderLines } from "../../services/home/feed-queries.js";
import { liveFestiveHero } from "../../services/festive-hero.js";
import { homeSectionsRoutes } from "./sections.js";
import { storeBanners } from "../../services/marketing/banner-feed.js";

export async function homeRoutes(app: FastifyInstance) {
  await app.register(homeSectionsRoutes);

  app.get<{ Params: { storeId: string } }>(
    "/:storeId",
    { preHandler: [authenticateOptional] },
    async (request, reply) => {
      const { storeId } = request.params;

      // Verify store exists
      const store = await app.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, organizationId: true },
      });
      if (!store) return reply.notFound("Store not found");

      const user = getOrgUser(request);
      const timePeriod = getTimePeriod();
      const timeCategoryNames = TIME_CATEGORY_MAP[timePeriod];

      const now = new Date();

      // Run 8 parallel queries
      const [collections, departments, timeCategories, dealsRaw, buyAgainRaw, bannersRaw, recipesRaw, festiveHero] = await Promise.all([
        // 1. Collections with products mapped to this store
        app.prisma.collection.findMany({
          where: {
            isActive: true,
            // A promo's products open from its banner, not as a home rail
            kind: { not: "PROMO" },
            OR: [
              { organizationId: store.organizationId },
              { organizationId: null },
            ],
            AND: liveWindow(now),
          },
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: {
                product: {
                  include: {
                    storeProducts: {
                      where: { storeId, isActive: true },
                      include: { variant: true },
                    },
                    brand: true,
                    subcategory: true,
                    variants: true,
                  },
                },
              },
            },
          },
        }),

        // 2. Departments (top-level)
        app.prisma.department.findMany({
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, slug: true, sortOrder: true, imageUrl: true, translations: true },
        }),

        // 3. Time-aware categories with products (search subcategories by name)
        app.prisma.subcategory.findMany({
          where: {
            name: { in: timeCategoryNames, mode: "insensitive" },
          },
          include: {
            products: {
              where: {
                isActive: true,
                storeProducts: { some: { storeId, isActive: true } },
              },
              take: 10,
              include: {
                storeProducts: {
                  where: { storeId, isActive: true },
                  include: { variant: true },
                },
                brand: true,
                subcategory: true,
                variants: true,
              },
            },
          },
        }),

        // 4. Deals — active discounts
        activeDealRows(app.prisma, storeId, now),

        // 5. Buy Again — from order history
        user.sub ? pastOrderLines(app.prisma, storeId, user.sub) : Promise.resolve([]),

        // 6. Banners — active banners for mobile placements (brand campaigns and slot caps applied)
        storeBanners(app.prisma, store, ["HERO_CAROUSEL", "CATEGORY_STRIP", "MID_PAGE", "POPUP"]),

        // 7. Recipes — active recipes with availability summary
        app.prisma.recipe.findMany({
          where: {
            isActive: true,
            OR: [
              { organizationId: store.organizationId },
              { organizationId: null },
            ],
          },
          orderBy: { sortOrder: "asc" },
          take: 6,
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: {
                product: {
                  include: {
                    storeProducts: {
                      where: { storeId, isActive: true },
                      orderBy: { price: "asc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        }),

        // 8. Festive hero — replaces the hero carousel while a festival is live
        liveFestiveHero(app.prisma, store),
      ]);

      // Transform collections: flatten to products with store data, filter empty
      const transformedCollections = collections
        .map((col) => {
          const products = col.items.flatMap((item) =>
            item.product.storeProducts.map((sp) => enrichStoreProduct({ ...sp, product: buildProductData(item.product) })),
          );

          return {
            id: col.id, title: col.title, subtitle: col.subtitle,
            slug: col.slug, imageUrl: col.imageUrl, kind: col.kind, translations: col.translations, products,
          };
        })
        .filter((col) => col.products.length > 0);

      // Transform time categories — every size of each product
      const transformedTimeCategories = timeCategories
        .filter((cat) => cat.products.length > 0)
        .map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          translations: cat.translations,
          products: cat.products.flatMap((p) =>
            p.storeProducts.map((sp) => enrichStoreProduct({ ...sp, product: buildProductData(p) })),
          ),
        }));

      const deals = await withAllSizes(app.prisma, storeId, dealsRaw);

      const buyAgain = await buyAgainProducts(app.prisma, storeId, buyAgainRaw);

      // Batch-fetch review aggregates for all products in the feed
      const allProductIds = [
        ...transformedCollections.flatMap((c) => c.products.map((p: any) => p.productId as string)),
        ...transformedTimeCategories.flatMap((tc) => tc.products.map((p: any) => p.productId as string)),
        ...deals.map((d: any) => d.productId as string),
        ...buyAgain.map((b: any) => b.productId as string),
      ];
      const reviewMap = await reviewSummaries(app.prisma, allProductIds);
      const addReviews = (items: any[]) => withReviews(items, reviewMap);

      for (const col of transformedCollections) col.products = addReviews(col.products) as any;
      for (const tc of transformedTimeCategories) tc.products = addReviews(tc.products) as any;
      const enrichedDeals = addReviews(deals);
      const enrichedBuyAgain = addReviews(buyAgain);

      // Transform recipes
      const recipes = recipesRaw.map((recipe) => {
        let availableCount = 0;
        let estimatedTotal = 0;
        for (const item of recipe.items) {
          const sp = item.product.storeProducts[0];
          if (sp) {
            availableCount++;
            estimatedTotal += Number(sp.price);
          }
        }
        return {
          id: recipe.id,
          title: recipe.title,
          slug: recipe.slug,
          imageUrl: recipe.imageUrl,
          difficulty: recipe.difficulty,
          cuisineType: recipe.cuisineType,
          dietType: recipe.dietType,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          translations: recipe.translations,
          ingredientCount: recipe.items.length,
          availableCount,
          estimatedTotal: Math.round(estimatedTotal * 100) / 100,
        };
      });

      const response: ApiResponse<{
        collections: typeof transformedCollections;
        departments: typeof departments;
        timeCategories: typeof transformedTimeCategories;
        timePeriod: TimePeriod;
        deals: typeof deals;
        buyAgain: typeof buyAgain;
        banners: typeof bannersRaw;
        recipes: typeof recipes;
        festiveHero: typeof festiveHero;
      }> = {
        success: true,
        data: {
          collections: transformedCollections,
          departments,
          timeCategories: transformedTimeCategories,
          timePeriod,
          deals: enrichedDeals,
          buyAgain: enrichedBuyAgain,
          banners: bannersRaw,
          recipes,
          festiveHero,
        },
      };
      return response;
    },
  );
}
