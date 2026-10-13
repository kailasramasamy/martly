import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";
import { predictReorders } from "../../services/reorder.js";

export async function smartReorderRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { storeId?: string } }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = getOrgUser(request);
      const { storeId } = request.query as { storeId?: string };

      if (!storeId) {
        return reply.badRequest("storeId query param is required");
      }

      // Verify store exists
      const store = await app.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true },
      });
      if (!store) return reply.notFound("Store not found");

      const predictions = await predictReorders(app.prisma, user.sub, storeId);
      if (predictions.length === 0) {
        return {
          success: true,
          data: {
            items: [],
            summary: { totalProducts: 0, overdueCount: 0, dueSoonCount: 0, estimatedTotal: 0 },
          },
        } satisfies ApiResponse<any>;
      }

      // 3. Fetch current StoreProduct data for all predicted items
      const spIds = predictions.map((p) => p.storeProductId);
      const storeProducts = await app.prisma.storeProduct.findMany({
        where: { id: { in: spIds }, isActive: true },
        include: {
          product: { include: { subcategory: true, brand: true, variants: true } },
          variant: true,
        },
      });

      const spMap = new Map(storeProducts.map((sp) => [sp.id, sp]));

      // 4. Build enriched response items
      const items: any[] = [];
      let estimatedTotal = 0;
      let overdueCount = 0;
      let dueSoonCount = 0;

      for (const pred of predictions) {
        const sp = spMap.get(pred.storeProductId);
        if (!sp) continue; // inactive or deleted

        const pricing = calculateEffectivePrice(
          sp.price as unknown as number,
          sp.variant as Parameters<typeof calculateEffectivePrice>[1],
          sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
        );
        const variant = formatVariantUnit(sp.variant);
        const availableStock = sp.stock - sp.reservedStock;

        if (pred.status === "overdue") overdueCount++;
        if (pred.status === "due_soon") dueSoonCount++;

        estimatedTotal += pricing.effectivePrice * pred.suggestedQuantity;

        items.push({
          id: sp.id,
          storeId: sp.storeId,
          productId: sp.productId,
          variantId: sp.variantId,
          price: sp.price,
          stock: sp.stock,
          reservedStock: sp.reservedStock,
          availableStock,
          isActive: sp.isActive,
          isFeatured: sp.isFeatured,
          product: {
            id: sp.product.id,
            name: sp.product.name,
            description: sp.product.description,
            imageUrl: sp.product.imageUrl,
            brand: sp.product.brand,
            foodType: sp.product.foodType,
            productType: sp.product.productType,
            subcategory: sp.product.subcategory,
            variants: sp.product.variants,
          },
          variant,
          pricing,
          prediction: {
            orderCount: pred.orderCount,
            avgQuantity: pred.avgQuantity,
            avgIntervalDays: pred.avgIntervalDays,
            daysSinceLast: pred.daysSinceLast,
            predictedNeed: Math.round(pred.predictedNeed * 100) / 100,
            status: pred.status,
          },
          suggestedQuantity: pred.suggestedQuantity,
        });
      }

      return {
        success: true,
        data: {
          items,
          summary: {
            totalProducts: items.length,
            overdueCount,
            dueSoonCount,
            estimatedTotal: Math.round(estimatedTotal),
          },
        },
      } satisfies ApiResponse<any>;
    },
  );
}
