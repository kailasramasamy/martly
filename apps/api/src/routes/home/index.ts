import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";

type TimePeriod = "morning" | "afternoon" | "evening" | "night";

const TIME_CATEGORY_MAP: Record<TimePeriod, string[]> = {
  morning: ["Fresh Curd (Dahi)", "Full Cream Milk", "Brown & Whole Wheat Bread", "Sandwich Bread", "Brown Eggs", "White Eggs", "Salted Butter", "Instant Coffee", "Tea Bags"],
  afternoon: ["Potato Chips", "Instant Noodles", "Cream Biscuits", "Fruit Juice (100%)", "Flavoured Milk", "Cup Noodles", "Kurkure & Extruded Snacks"],
  evening: ["Tomato", "Onion & Garlic", "Potato", "Ground Spices", "Sunflower Oil", "Chicken Curry Cut", "Basmati Rice", "Wheat Atta"],
  night: ["Frozen Pizza & Burger Patty", "Ice Cream Tubs", "Chocolate Bars & Countlines", "Frozen Samosa & Spring Roll", "Bhujia & Sev", "Mixture & Chivda"],
};

function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function enrichStoreProduct(sp: any) {
  const pricing = calculateEffectivePrice(
    sp.price as unknown as number,
    sp.variant as Parameters<typeof calculateEffectivePrice>[1],
    sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
  );
  const variant = formatVariantUnit(sp.variant);
  return { ...sp, variant, pricing, availableStock: sp.stock - sp.reservedStock };
}

export async function homeRoutes(app: FastifyInstance) {
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
      const hour = new Date().getHours();
      const timePeriod = getTimePeriod(hour);
      const timeCategoryNames = TIME_CATEGORY_MAP[timePeriod];

      const storeProductInclude = {
        product: { include: { subcategory: true, brand: true, variants: true } },
        variant: true,
      };

      const now = new Date();

      // Run 7 parallel queries
      const [collections, departments, timeCategories, dealsRaw, buyAgainRaw, bannersRaw, recipesRaw] = await Promise.all([
        // 1. Collections with products mapped to this store
        app.prisma.collection.findMany({
          where: {
            isActive: true,
            OR: [
              { organizationId: store.organizationId },
              { organizationId: null },
            ],
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
        (() => {
          return app.prisma.storeProduct.findMany({
            where: {
              storeId,
              isActive: true,
              discountType: { not: null },
              discountValue: { gt: 0 },
              OR: [
                { discountStart: null, discountEnd: null },
                { discountStart: { lte: now }, discountEnd: null },
                { discountStart: null, discountEnd: { gte: now } },
                { discountStart: { lte: now }, discountEnd: { gte: now } },
              ],
            },
            take: 10,
            include: storeProductInclude,
          });
        })(),

        // 5. Buy Again — from order history
        user.sub
          ? app.prisma.orderItem.findMany({
              where: {
                order: {
                  userId: user.sub,
                  storeId,
                  status: { in: ["DELIVERED", "CONFIRMED"] },
                },
              },
              distinct: ["productId"],
              orderBy: { order: { createdAt: "desc" } },
              take: 10,
              include: {
                storeProduct: {
                  include: storeProductInclude,
                },
              },
            })
          : Promise.resolve([]),

        // 6. Banners — active banners for mobile placements
        app.prisma.banner.findMany({
          where: {
            isActive: true,
            placement: { in: ["HERO_CAROUSEL", "CATEGORY_STRIP", "MID_PAGE", "POPUP"] },
            OR: [
              { storeId },
              { storeId: null, organizationId: store.organizationId },
              { storeId: null, organizationId: null },
            ],
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            subtitle: true,
            imageUrl: true,
            placement: true,
            actionType: true,
            actionTarget: true,
          },
        }),

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
      ]);

      // Helper to build product data object
      function buildProductData(p: any) {
        return {
          id: p.id, name: p.name, description: p.description, imageUrl: p.imageUrl,
          brand: p.brand, foodType: p.foodType, productType: p.productType,
          regulatoryMarks: p.regulatoryMarks, certifications: p.certifications,
          dangerWarnings: p.dangerWarnings, subcategory: p.subcategory, variants: p.variants,
          translations: p.translations,
        };
      }

      // The app groups rows by product and offers a size picker, so every section sends all active sizes
      async function withAllSizes(rows: any[]) {
        const productIds = [...new Set(rows.map((r) => r.productId as string))];
        if (productIds.length === 0) return [];
        const all = await app.prisma.storeProduct.findMany({
          where: { storeId, isActive: true, productId: { in: productIds } },
          include: storeProductInclude,
        });
        const byProduct = new Map<string, any[]>();
        for (const sp of all) byProduct.set(sp.productId, [...(byProduct.get(sp.productId) ?? []), sp]);
        return productIds.flatMap((id) => (byProduct.get(id) ?? []).map(enrichStoreProduct));
      }

      // Transform collections: flatten to products with store data, filter empty
      const transformedCollections = collections
        .map((col) => {
          const products = col.items.flatMap((item) =>
            item.product.storeProducts.map((sp) => enrichStoreProduct({ ...sp, product: buildProductData(item.product) })),
          );

          return {
            id: col.id, title: col.title, subtitle: col.subtitle,
            slug: col.slug, imageUrl: col.imageUrl, products,
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

      const deals = await withAllSizes(dealsRaw);

      // Buy again: previously ordered rows, topped up with related products below
      const buyAgainRows: any[] = buyAgainRaw
        .filter((item: any) => item.storeProduct?.product)
        .map((item: any) => item.storeProduct);

      // Supplement buy again with related products if < 6 items
      const BUY_AGAIN_MIN = 6;
      if (buyAgainRows.length > 0 && buyAgainRows.length < BUY_AGAIN_MIN) {
        const existingProductIds = buyAgainRows.map((b: any) => b.productId as string);
        const subcategoryIds = [...new Set(buyAgainRows.map((b: any) => b.product?.subcategory?.id).filter(Boolean))] as string[];

        // First try same subcategories
        let supplementRaw: any[] = [];
        if (subcategoryIds.length > 0) {
          supplementRaw = await app.prisma.storeProduct.findMany({
            where: {
              storeId,
              isActive: true,
              product: {
                subcategoryId: { in: subcategoryIds },
                id: { notIn: existingProductIds },
                isActive: true,
              },
            },
            take: BUY_AGAIN_MIN - buyAgainRows.length,
            orderBy: { stock: "desc" },
            include: storeProductInclude,
          });
        }

        // If still not enough, fill with popular/featured products from any category
        const stillNeeded = BUY_AGAIN_MIN - buyAgainRows.length - supplementRaw.length;
        if (stillNeeded > 0) {
          const excludeProductIds = [
            ...existingProductIds,
            ...supplementRaw.map((sp: any) => sp.productId as string),
          ];
          const popularRaw = await app.prisma.storeProduct.findMany({
            where: {
              storeId,
              isActive: true,
              stock: { gt: 0 },
              product: {
                id: { notIn: excludeProductIds },
                isActive: true,
              },
            },
            take: stillNeeded,
            orderBy: [{ isFeatured: "desc" }, { stock: "desc" }],
            include: storeProductInclude,
          });
          supplementRaw = [...supplementRaw, ...popularRaw];
        }
        buyAgainRows.push(...supplementRaw);

      }

      const buyAgain = await withAllSizes(buyAgainRows);

      // Batch-fetch review aggregates for all products in the feed
      const allProductIds = [
        ...transformedCollections.flatMap((c) => c.products.map((p: any) => p.productId as string)),
        ...transformedTimeCategories.flatMap((tc) => tc.products.map((p: any) => p.productId as string)),
        ...deals.map((d: any) => d.productId as string),
        ...buyAgain.map((b: any) => b.productId as string),
      ];
      const uniqueProductIds = [...new Set(allProductIds)];
      const reviewAggs = uniqueProductIds.length > 0
        ? await app.prisma.review.groupBy({
            by: ["productId"],
            where: { productId: { in: uniqueProductIds }, status: "APPROVED" },
            _avg: { rating: true },
            _count: { rating: true },
          })
        : [];
      const reviewMap = new Map(reviewAggs.map((r) => [r.productId, { averageRating: Math.round((r._avg.rating ?? 0) * 10) / 10, reviewCount: r._count.rating }]));

      // Merge review data into products
      const addReviews = (items: any[]) => items.map((item) => {
        const rev = reviewMap.get(item.productId);
        return rev ? { ...item, product: { ...item.product, averageRating: rev.averageRating, reviewCount: rev.reviewCount } } : item;
      });

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
        },
      };
      return response;
    },
  );
}
