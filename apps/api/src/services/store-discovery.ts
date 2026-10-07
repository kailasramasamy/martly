import type { PrismaClient } from "../../generated/prisma/client.js";

export interface StoreDiscoveryInfo {
  ratingAvg: number | null;
  ratingCount: number;
  expressEtaMinutes: number | null;
  operatingStart: string | null;
  operatingEnd: string | null;
}

// Rating and express-delivery summary for each store, for customer-facing store lists.
export async function getStoreDiscoveryInfo(
  prisma: PrismaClient,
  storeIds: string[],
): Promise<Map<string, StoreDiscoveryInfo>> {
  if (storeIds.length === 0) return new Map();

  const [ratings, expressConfigs] = await Promise.all([
    prisma.storeRating.groupBy({
      by: ["storeId"],
      where: { storeId: { in: storeIds } },
      _avg: { overallRating: true },
      _count: { _all: true },
    }),
    prisma.expressDeliveryConfig.findMany({
      where: { storeId: { in: storeIds }, isEnabled: true },
      select: { storeId: true, etaMinutes: true, operatingStart: true, operatingEnd: true },
    }),
  ]);

  const ratingByStore = new Map(ratings.map((r) => [r.storeId, r]));
  const expressByStore = new Map(expressConfigs.map((e) => [e.storeId, e]));

  return new Map(
    storeIds.map((id) => {
      const rating = ratingByStore.get(id);
      const express = expressByStore.get(id);
      const avg = rating?._avg.overallRating;
      return [
        id,
        {
          ratingAvg: avg != null ? Math.round(avg * 10) / 10 : null,
          ratingCount: rating?._count._all ?? 0,
          expressEtaMinutes: express?.etaMinutes ?? null,
          operatingStart: express?.operatingStart ?? null,
          operatingEnd: express?.operatingEnd ?? null,
        },
      ];
    }),
  );
}
