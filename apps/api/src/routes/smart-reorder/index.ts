import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";

type PredictionStatus = "overdue" | "due_soon" | "not_yet";

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

      // 1. Query all order items for this user+store from delivered/confirmed orders
      const orderItems = await app.prisma.orderItem.findMany({
        where: {
          order: {
            userId: user.sub,
            storeId,
            status: { in: ["DELIVERED", "CONFIRMED"] },
          },
        },
        select: {
          productId: true,
          variantId: true,
          storeProductId: true,
          quantity: true,
          order: { select: { createdAt: true } },
        },
        orderBy: { order: { createdAt: "asc" } },
      });

      if (orderItems.length === 0) {
        return {
          success: true,
          data: {
            items: [],
            summary: { totalProducts: 0, overdueCount: 0, dueSoonCount: 0, estimatedTotal: 0 },
          },
        } satisfies ApiResponse<any>;
      }

      // 2. Group by productId:variantId — compute prediction metrics
      const groupMap = new Map<
        string,
        {
          productId: string;
          variantId: string;
          storeProductId: string;
          orderCount: number;
          totalQty: number;
          firstOrdered: Date;
          lastOrdered: Date;
        }
      >();

      for (const item of orderItems) {
        const key = `${item.productId}:${item.variantId}`;
        const existing = groupMap.get(key);
        const orderDate = item.order.createdAt;

        if (existing) {
          existing.orderCount += 1;
          existing.totalQty += item.quantity;
          if (orderDate < existing.firstOrdered) existing.firstOrdered = orderDate;
          if (orderDate > existing.lastOrdered) existing.lastOrdered = orderDate;
        } else {
          groupMap.set(key, {
            productId: item.productId,
            variantId: item.variantId,
            storeProductId: item.storeProductId,
            orderCount: 1,
            totalQty: item.quantity,
            firstOrdered: orderDate,
            lastOrdered: orderDate,
          });
        }
      }

      const now = new Date();
      const predictions: Array<{
        storeProductId: string;
        productId: string;
        variantId: string;
        orderCount: number;
        avgQuantity: number;
        avgIntervalDays: number | null;
        daysSinceLast: number;
        predictedNeed: number;
        status: PredictionStatus;
        suggestedQuantity: number;
      }> = [];

      for (const g of groupMap.values()) {
        const avgQuantity = Math.round(g.totalQty / g.orderCount);
        const daysSinceLast = Math.round(
          (now.getTime() - g.lastOrdered.getTime()) / (1000 * 60 * 60 * 24),
        );

        let avgIntervalDays: number | null = null;
        let predictedNeed: number;

        if (g.orderCount >= 2) {
          const spanDays =
            (g.lastOrdered.getTime() - g.firstOrdered.getTime()) / (1000 * 60 * 60 * 24);
          avgIntervalDays = Math.round(spanDays / (g.orderCount - 1));
          predictedNeed = avgIntervalDays > 0 ? daysSinceLast / avgIntervalDays : 0.3;
        } else {
          // Single-purchase products get low priority
          predictedNeed = 0.3;
        }

        let status: PredictionStatus;
        if (predictedNeed >= 1.0) {
          status = "overdue";
        } else if (predictedNeed >= 0.7) {
          status = "due_soon";
        } else {
          status = "not_yet";
        }

        predictions.push({
          storeProductId: g.storeProductId,
          productId: g.productId,
          variantId: g.variantId,
          orderCount: g.orderCount,
          avgQuantity,
          avgIntervalDays,
          daysSinceLast,
          predictedNeed,
          status,
          suggestedQuantity: avgQuantity,
        });
      }

      // Sort by predictedNeed descending
      predictions.sort((a, b) => b.predictedNeed - a.predictedNeed);

      // 3. Fetch current StoreProduct data for all predicted items
      const spIds = predictions.map((p) => p.storeProductId);
      const storeProducts = await app.prisma.storeProduct.findMany({
        where: { id: { in: spIds }, isActive: true },
        include: {
          product: { include: { category: true, brand: true, variants: true } },
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
            category: sp.product.category,
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
