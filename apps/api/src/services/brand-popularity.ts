import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import { regionOf } from "./onboarding/create.js";

/** The region whose brand scores apply at a store, from its state; null where no region code covers the state */
export async function storeRegion(prisma: PrismaClient, storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { state: true } });
  return regionOf(store?.state ?? null);
}

/** A brand's popularity in the region when it has a regional score, else its national one (brands joined as `alias`) */
export function brandPopularitySql(region: string | null, alias = "b") {
  const b = Prisma.raw(alias);
  if (!region) return Prisma.sql`COALESCE(${b}.popularity, 0)`;
  return Prisma.sql`COALESCE((SELECT rp.popularity FROM brand_region_popularity rp WHERE rp.brand_id = ${b}.id AND rp.region = ${region}), ${b}.popularity, 0)`;
}
