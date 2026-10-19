import type { PrismaClient } from "../../../generated/prisma/client.js";

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
