import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { WebTownPage } from "@martly/shared/types";
import { getStoreDiscoveryInfo } from "../store-discovery.js";
import { deliveryOf } from "./store-profile.js";

export const webStoreSelect = { id: true, name: true, slug: true, tagline: true, address: true, imageUrl: true, logoUrl: true, size: true } as const;
export const liveStore = { status: "ACTIVE" as const, organization: { isTemplate: false } };

/** Products a shopper can buy at each store, counting a product once across its sizes */
async function productCounts(prisma: PrismaClient, storeIds: string[]) {
  const rows = await prisma.$queryRaw<{ store_id: string; products: number }[]>`
    SELECT sp.store_id, count(DISTINCT sp.product_id)::int AS products
    FROM store_products sp JOIN products p ON p.id = sp.product_id
    WHERE sp.store_id = ANY(${storeIds}) AND sp.is_active AND p.is_active
    GROUP BY sp.store_id`;
  return new Map(rows.map((r) => [r.store_id, r.products]));
}

/** A town's live stores with their covers, delivery, deals and ratings, for martlyshop.in/{town} */
export async function townPage(prisma: PrismaClient, slug: string): Promise<WebTownPage | null> {
  const town = await prisma.town.findFirst({
    where: { slug, stores: { some: liveStore } },
    select: {
      name: true, slug: true, district: true, state: true,
      stores: {
        where: liveStore,
        orderBy: [{ launchedAt: "asc" }, { name: "asc" }],
        select: { ...webStoreSelect, brandColor: true, offerText: true, freeDeliveryThreshold: true },
      },
    },
  });
  if (!town) return null;
  const ids = town.stores.map((s) => s.id);
  const [info, counts] = await Promise.all([getStoreDiscoveryInfo(prisma, ids), productCounts(prisma, ids)]);
  const { stores, ...place } = town;
  return {
    town: place,
    stores: stores.map(({ freeDeliveryThreshold, ...store }) => {
      const i = info.get(store.id)!;
      const express = i.expressEtaMinutes == null ? null : { etaMinutes: i.expressEtaMinutes, operatingStart: i.operatingStart, operatingEnd: i.operatingEnd };
      return {
        ...store,
        coverUrl: i.banners[0]?.imageUrl ?? store.imageUrl,
        productCount: counts.get(store.id) ?? 0,
        freeDeliveryAbove: freeDeliveryThreshold == null ? null : Number(freeDeliveryThreshold),
        rating: i.ratingAvg == null ? null : { average: i.ratingAvg, count: i.ratingCount },
        deals: i.deals,
        delivery: deliveryOf(express, i.slots[0]),
      };
    }),
  };
}
