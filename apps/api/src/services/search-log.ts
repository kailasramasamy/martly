import type { PrismaClient } from "../../generated/prisma/client.js";
import type { SearchEventType } from "@martly/shared/constants";
import { createRateLimiter } from "./rate-limit.js";

const LOG_LIMIT = 30;
const LOG_WINDOW_MS = 60_000;

/** Caps how fast one client can write search logs and events, so trending can't be stuffed */
export const allowSearchLog = createRateLimiter(LOG_LIMIT, LOG_WINDOW_MS);

export function logSearch(prisma: PrismaClient, entry: { storeId: string; userId: string | null; query: string; resultCount: number }) {
  return prisma.searchLog.create({
    data: { ...entry, query: entry.query.replace(/\s+/g, " ") },
    select: { id: true },
  });
}

/**
 * A result tapped or added to cart from a logged search: the add-to-cart rate per query and product, for ranking.
 * Returns what was missing, or null once recorded; a search logged for someone else counts as missing.
 */
export async function recordSearchEvent(
  prisma: PrismaClient, event: { searchLogId: string; productId: string; type: SearchEventType; position: number }, userId: string | null,
): Promise<"search" | "product" | null> {
  const [log, product] = await Promise.all([
    prisma.searchLog.findUnique({ where: { id: event.searchLogId }, select: { userId: true } }),
    prisma.product.findUnique({ where: { id: event.productId }, select: { id: true } }),
  ]);
  if (!log || (log.userId && log.userId !== userId)) return "search";
  if (!product) return "product";
  // One event per search, product and type: re-tapping the same result doesn't count twice
  await prisma.searchEvent.createMany({ data: [event], skipDuplicates: true });
  return null;
}
