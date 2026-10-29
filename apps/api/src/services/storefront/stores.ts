import type { StorefrontGroup } from "@martly/shared/constants";
import type { StorefrontStoreRow } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { istDateKey } from "../ist-day.js";
import { mapLimit } from "../map-limit.js";
import { storefrontHealth } from "./health.js";

const DAY_MS = 86_400_000;
// Stores without today's snapshot are scored this many at a time, so one visit doesn't run every store's checks at once
const COMPUTE_AT_ONCE = 2;
const dateOf = (offsetDays: number) => new Date(`${istDateKey(new Date(Date.now() - offsetDays * DAY_MS))}T00:00:00Z`);

/** Active stores with their score, weakest first; `storeIds` undefined means every store (Martly staff) */
export async function storefrontStores(prisma: PrismaClient, storeIds: string[] | undefined): Promise<StorefrontStoreRow[]> {
  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE", ...(storeIds && { id: { in: storeIds } }) },
    select: { id: true, name: true, organization: { select: { name: true } } },
  });
  const [todays, weekAgo] = await Promise.all([
    prisma.storefrontHealthSnapshot.findMany({ where: { storeId: { in: stores.map((s) => s.id) }, date: dateOf(0) } }),
    prisma.storefrontHealthSnapshot.findMany({ where: { storeId: { in: stores.map((s) => s.id) }, date: dateOf(7) } }),
  ]);
  const rows = await mapLimit(stores, COMPUTE_AT_ONCE, async (s) => {
    const snap = todays.find((t) => t.storeId === s.id);
    const { score, groups } = snap ?? (await storefrontHealth(prisma, s.id));
    const before = weekAgo.find((w) => w.storeId === s.id);
    return {
      storeId: s.id, storeName: s.name, organizationName: s.organization.name, score,
      groups: groups as Record<StorefrontGroup, number | null>, weekChange: before ? score - before.score : null,
    };
  });
  return rows.sort((a, b) => a.score - b.score);
}
