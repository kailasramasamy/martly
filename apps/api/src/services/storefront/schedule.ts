import type { PrismaClient } from "../../../generated/prisma/client.js";
import { storefrontHealth, today } from "./health.js";

/** A store's snapshot is worked out again once it's this old, so each day's point reflects the store late in the day */
export const SNAPSHOT_REFRESH_MS = 6 * 60 * 60_000;

/** Stores with no snapshot for today yet, or one older than SNAPSHOT_REFRESH_MS */
export function storesDue(storeIds: string[], snapshots: { storeId: string; updatedAt: Date }[], now: Date) {
  const updated = new Map(snapshots.map((s) => [s.storeId, s.updatedAt.getTime()]));
  return storeIds.filter((id) => {
    const at = updated.get(id);
    return at === undefined || now.getTime() - at >= SNAPSHOT_REFRESH_MS;
  });
}

/** Scores every active store that's due, one at a time, recording each as today's snapshot */
export async function refreshDueSnapshots(prisma: PrismaClient, now = new Date()) {
  const [stores, snapshots] = await Promise.all([
    prisma.store.findMany({ where: { status: "ACTIVE" }, select: { id: true } }),
    prisma.storefrontHealthSnapshot.findMany({ where: { date: today(now) }, select: { storeId: true, updatedAt: true } }),
  ]);
  const due = storesDue(stores.map((s) => s.id), snapshots, now);
  for (const storeId of due) await storefrontHealth(prisma, storeId, true);
  return due.length;
}
