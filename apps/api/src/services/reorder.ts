import type { PrismaClient } from "../../generated/prisma/client.js";

export type PredictionStatus = "overdue" | "due_soon" | "not_yet";

const DAY_MS = 1000 * 60 * 60 * 24;
// Single-purchase products have no interval yet, so they get low priority
const SINGLE_PURCHASE_NEED = 0.3;

interface PurchaseGroup {
  productId: string;
  variantId: string;
  storeProductId: string;
  orderCount: number;
  totalQty: number;
  firstOrdered: Date;
  lastOrdered: Date;
}

export interface ReorderPrediction {
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
}

function groupPurchases(items: { productId: string; variantId: string; storeProductId: string; quantity: number; order: { createdAt: Date } }[]) {
  const groups = new Map<string, PurchaseGroup>();
  for (const item of items) {
    const key = `${item.productId}:${item.variantId}`;
    const at = item.order.createdAt;
    const g = groups.get(key);
    if (g) {
      g.orderCount += 1;
      g.totalQty += item.quantity;
      if (at < g.firstOrdered) g.firstOrdered = at;
      if (at > g.lastOrdered) g.lastOrdered = at;
    } else {
      groups.set(key, {
        productId: item.productId, variantId: item.variantId, storeProductId: item.storeProductId,
        orderCount: 1, totalQty: item.quantity, firstOrdered: at, lastOrdered: at,
      });
    }
  }
  return [...groups.values()];
}

function predict(g: PurchaseGroup, now: Date): ReorderPrediction {
  const avgQuantity = Math.round(g.totalQty / g.orderCount);
  const daysSinceLast = Math.round((now.getTime() - g.lastOrdered.getTime()) / DAY_MS);
  let avgIntervalDays: number | null = null;
  let predictedNeed = SINGLE_PURCHASE_NEED;
  if (g.orderCount >= 2) {
    avgIntervalDays = Math.round((g.lastOrdered.getTime() - g.firstOrdered.getTime()) / DAY_MS / (g.orderCount - 1));
    predictedNeed = avgIntervalDays > 0 ? daysSinceLast / avgIntervalDays : SINGLE_PURCHASE_NEED;
  }
  const status: PredictionStatus = predictedNeed >= 1 ? "overdue" : predictedNeed >= 0.7 ? "due_soon" : "not_yet";
  return {
    storeProductId: g.storeProductId, productId: g.productId, variantId: g.variantId,
    orderCount: g.orderCount, avgQuantity, avgIntervalDays, daysSinceLast, predictedNeed, status,
    suggestedQuantity: avgQuantity,
  };
}

/**
 * Reorder predictions from a customer's delivered/confirmed orders at a store,
 * most-needed first. predictedNeed = days since last order / average interval.
 */
export async function predictReorders(prisma: PrismaClient, userId: string, storeId: string): Promise<ReorderPrediction[]> {
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { userId, storeId, status: { in: ["DELIVERED", "CONFIRMED"] } } },
    select: { productId: true, variantId: true, storeProductId: true, quantity: true, order: { select: { createdAt: true } } },
    orderBy: { order: { createdAt: "asc" } },
  });
  const now = new Date();
  return groupPurchases(orderItems).map((g) => predict(g, now)).sort((a, b) => b.predictedNeed - a.predictedNeed);
}
