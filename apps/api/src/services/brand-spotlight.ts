import type { BrandSpotlight } from "@martly/shared/types";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { regionOf } from "./onboarding/create.js";
import { storeBanners } from "./marketing/banner-feed.js";
import { istDateKey } from "./ist-day.js";

// The tab bar rotates daily through this many of the store's best-known brand stores
const SPOTLIGHT_POOL = 5;

const stockedAt = (storeId: string) => ({ products: { some: { isActive: true, storeProducts: { some: { storeId, isActive: true } } } } });

/**
 * The brand in the shopper tab bar's last slot: a brand that booked the tab slot for this store (marked as an ad),
 * else the organisation's own brand when it promotes its own brands, else one of the store's best-known stocked brand
 * stores, rotating each day.
 */
export async function brandSpotlight(prisma: PrismaClient, storeId: string): Promise<BrandSpotlight | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId }, select: { id: true, state: true, organizationId: true, organization: { select: { boostOwnBrands: true } } },
  });
  if (!store) return null;
  const [paid] = await storeBanners(prisma, store, ["BRAND_TAB"]);
  if (paid?.brandId) {
    const brand = await prisma.brand.findUniqueOrThrow({ where: { id: paid.brandId }, select: { id: true, name: true } });
    return { ...brand, imageUrl: paid.imageUrl, sponsored: { bannerId: paid.id } };
  }
  if (store.organization.boostOwnBrands) {
    const own = await prisma.brand.findFirst({
      where: { organizationId: store.organizationId, imageUrl: { not: null }, ...stockedAt(storeId) },
      orderBy: { name: "asc" }, select: { id: true, name: true, imageUrl: true },
    });
    if (own) return { ...own, imageUrl: own.imageUrl! };
  }
  const region = regionOf(store.state) ?? "";
  const brands = await prisma.brand.findMany({
    where: { themeColor: { not: null }, imageUrl: { not: null }, ...stockedAt(storeId) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, imageUrl: true, popularity: true, regionalPopularity: { where: { region }, select: { popularity: true } } },
  });
  const score = (b: (typeof brands)[number]) => b.regionalPopularity[0]?.popularity ?? b.popularity;
  const pool = brands.sort((a, b) => score(b) - score(a)).slice(0, SPOTLIGHT_POOL).map(({ id, name, imageUrl }) => ({ id, name, imageUrl }));
  if (!pool.length) return null;
  const day = Math.floor(new Date(istDateKey(new Date())).getTime() / 86_400_000);
  const pick = pool[day % pool.length];
  return { ...pick, imageUrl: pick.imageUrl! };
}
