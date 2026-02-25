import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";

type TimePeriod = "morning" | "afternoon" | "evening" | "night";

const TIME_CATEGORY_MAP: Record<TimePeriod, string[]> = {
  morning: ["Dairy", "Bakery", "Tea & Coffee", "Eggs", "Milk", "Bread", "Butter & Ghee"],
  afternoon: ["Snacks", "Beverages", "Ready to Eat", "Chips & Crisps", "Biscuits", "Juices"],
  evening: ["Vegetables", "Spices", "Cooking Oil", "Meat", "Fruits", "Pulses & Lentils"],
  night: ["Frozen Food", "Snacks", "Chocolates & Sweets", "Ice Cream", "Chocolates", "Namkeen"],
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
        product: { include: { category: true, brand: true, variants: true } },
        variant: true,
      };

      // Run 5 parallel queries
      const [collections, categories, timeCategories, dealsRaw, buyAgainRaw] = await Promise.all([
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
                    category: true,
                    variants: true,
                  },
                },
              },
            },
          },
        }),

        // 2. Root categories
        app.prisma.category.findMany({
          where: { parentId: null },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, slug: true, parentId: true, sortOrder: true, imageUrl: true },
        }),

        // 3. Time-aware categories with products
        app.prisma.category.findMany({
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
                category: true,
                variants: true,
              },
            },
          },
        }),

        // 4. Deals — active discounts
        (() => {
          const now = new Date();
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
      ]);

      // Batch-query variant counts for deals and buy again products
      const dealsAndBuyAgainProductIds = [
        ...dealsRaw.map((sp: any) => sp.productId as string),
        ...buyAgainRaw.filter((item: any) => item.storeProduct?.productId).map((item: any) => item.storeProduct.productId as string),
      ];
      const variantCountMap = new Map<string, number>();
      if (dealsAndBuyAgainProductIds.length > 0) {
        const counts = await app.prisma.storeProduct.groupBy({
          by: ["productId"],
          where: { storeId, isActive: true, productId: { in: dealsAndBuyAgainProductIds } },
          _count: true,
        });
        for (const c of counts) variantCountMap.set(c.productId, c._count);
      }

      // Helper to build product data object
      function buildProductData(p: any) {
        return {
          id: p.id, name: p.name, description: p.description, imageUrl: p.imageUrl,
          brand: p.brand, foodType: p.foodType, productType: p.productType,
          regulatoryMarks: p.regulatoryMarks, certifications: p.certifications,
          dangerWarnings: p.dangerWarnings, category: p.category, variants: p.variants,
        };
      }

      // Transform collections: flatten to products with store data, filter empty
      const transformedCollections = collections
        .map((col) => {
          const products = col.items
            .filter((item) => item.product.storeProducts.length > 0)
            .map((item) => {
              const sp = item.product.storeProducts[0];
              return {
                ...enrichStoreProduct({ ...sp, product: buildProductData(item.product) }),
                variantCount: item.product.storeProducts.length,
              };
            });

          return {
            id: col.id, title: col.title, subtitle: col.subtitle,
            slug: col.slug, imageUrl: col.imageUrl, products,
          };
        })
        .filter((col) => col.products.length > 0);

      // Transform time categories — group variants, include variantCount
      const transformedTimeCategories = timeCategories
        .filter((cat) => cat.products.length > 0)
        .map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          products: cat.products
            .filter((p) => p.storeProducts.length > 0)
            .map((p) => {
              const sp = p.storeProducts[0];
              return {
                ...enrichStoreProduct({ ...sp, product: buildProductData(p) }),
                variantCount: p.storeProducts.length,
              };
            }),
        }));

      // Transform deals
      const deals = dealsRaw.map((sp: any) => ({
        ...enrichStoreProduct(sp),
        variantCount: variantCountMap.get(sp.productId) ?? 1,
      }));

      // Transform buy again
      const buyAgain = buyAgainRaw
        .filter((item: any) => item.storeProduct?.product)
        .map((item: any) => ({
          ...enrichStoreProduct(item.storeProduct),
          variantCount: variantCountMap.get(item.storeProduct.productId) ?? 1,
        }));

      // Add children: [] to match CategoryTreeNode type
      const categoriesWithChildren = categories.map((cat) => ({ ...cat, children: [] }));

      const response: ApiResponse<{
        collections: typeof transformedCollections;
        categories: typeof categoriesWithChildren;
        timeCategories: typeof transformedTimeCategories;
        timePeriod: TimePeriod;
        deals: typeof deals;
        buyAgain: typeof buyAgain;
      }> = {
        success: true,
        data: {
          collections: transformedCollections,
          categories: categoriesWithChildren,
          timeCategories: transformedTimeCategories,
          timePeriod,
          deals,
          buyAgain,
        },
      };
      return response;
    },
  );
}
