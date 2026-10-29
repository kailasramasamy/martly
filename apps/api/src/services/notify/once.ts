import type { PrismaClient } from "../../../generated/prisma/client.js";
import { utc } from "../listing-sql.js";

/**
 * Claims a one-time alert key. Returns true only for the first caller, so schedulers
 * that re-scan every minute fire each alert once.
 */
export async function alertOnce(prisma: PrismaClient, key: string): Promise<boolean> {
  const { count } = await prisma.alertOnce.createMany({ data: [{ key }], skipDuplicates: true });
  return count === 1;
}

/** Claims many one-time alert keys in a single statement and returns the ones this caller won */
export async function claimOnce(prisma: PrismaClient, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO alert_once (key) SELECT unnest(${keys}::text[]) ON CONFLICT DO NOTHING RETURNING key`;
  return new Set(rows.map((r) => r.key));
}

/**
 * A key only has to outlive the window its scanner looks back over: the longest is a monthly list's month, then
 * attention escalations' 7 days; event keys (payment failed, rider assigned) only dedupe retries within a day.
 */
export const ALERT_KEY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const PRUNE_BATCH = 5000;

export const alertKeyCutoff = (now: Date) => new Date(now.getTime() - ALERT_KEY_RETENTION_MS);

/** Deletes alert keys past retention in batches, so a large backlog never holds one long lock; returns how many went */
export async function pruneAlertKeys(prisma: PrismaClient, now = new Date()): Promise<number> {
  const cutoff = utc(alertKeyCutoff(now));
  let total = 0;
  for (;;) {
    const deleted = await prisma.$executeRaw`
      DELETE FROM alert_once WHERE key IN (SELECT key FROM alert_once WHERE created_at < ${cutoff} LIMIT ${PRUNE_BATCH})`;
    total += deleted;
    if (deleted < PRUNE_BATCH) return total;
  }
}

const PROMO_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Customers get at most one automatic promotional push a day; manual campaigns bypass this */
export async function promotionalAllowed(prisma: PrismaClient, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const recent = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      type: { in: ["PROMOTIONAL", "WISHLIST_ALERT"] },
      createdAt: { gte: new Date(Date.now() - PROMO_WINDOW_MS) },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const capped = new Set(recent.map((r) => r.userId));
  return userIds.filter((id) => !capped.has(id));
}
