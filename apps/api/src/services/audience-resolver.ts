import type { PrismaClient, AudienceType } from "../../generated/prisma/client.js";

interface AudienceConfig {
  storeId?: string;
  days?: number;
  minAmount?: number;
}

/**
 * Resolves a list of user IDs matching the given audience segment,
 * scoped to the organization's stores.
 */
export async function resolveAudience(
  prisma: PrismaClient,
  organizationId: string,
  audienceType: AudienceType,
  config?: AudienceConfig,
): Promise<string[]> {
  // Get all store IDs for the org
  const orgStores = await prisma.store.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const orgStoreIds = orgStores.map((s) => s.id);
  if (orgStoreIds.length === 0) return [];

  switch (audienceType) {
    case "ALL_CUSTOMERS": {
      const orders = await prisma.order.findMany({
        where: { storeId: { in: orgStoreIds } },
        select: { userId: true },
        distinct: ["userId"],
      });
      return orders.map((o) => o.userId);
    }

    case "STORE_CUSTOMERS": {
      const storeId = config?.storeId;
      if (!storeId || !orgStoreIds.includes(storeId)) return [];
      const orders = await prisma.order.findMany({
        where: { storeId },
        select: { userId: true },
        distinct: ["userId"],
      });
      return orders.map((o) => o.userId);
    }

    case "ORDERED_LAST_N_DAYS": {
      const days = config?.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const orders = await prisma.order.findMany({
        where: {
          storeId: { in: orgStoreIds },
          createdAt: { gte: since },
        },
        select: { userId: true },
        distinct: ["userId"],
      });
      return orders.map((o) => o.userId);
    }

    case "NOT_ORDERED_N_DAYS": {
      const days = config?.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Users who ordered before but not recently
      const allCustomers = await prisma.order.findMany({
        where: { storeId: { in: orgStoreIds } },
        select: { userId: true },
        distinct: ["userId"],
      });
      const recentCustomers = await prisma.order.findMany({
        where: {
          storeId: { in: orgStoreIds },
          createdAt: { gte: since },
        },
        select: { userId: true },
        distinct: ["userId"],
      });
      const recentSet = new Set(recentCustomers.map((o) => o.userId));
      return allCustomers.map((o) => o.userId).filter((id) => !recentSet.has(id));
    }

    case "HIGH_VALUE_CUSTOMERS": {
      const minAmount = config?.minAmount ?? 1000;
      const result = await prisma.order.groupBy({
        by: ["userId"],
        where: { storeId: { in: orgStoreIds } },
        _sum: { totalAmount: true },
        having: {
          totalAmount: { _sum: { gte: minAmount } },
        },
      });
      return result.map((r) => r.userId);
    }

    default:
      return [];
  }
}
