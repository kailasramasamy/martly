import { DEFAULT_SEARCH_HINTS, MAX_SEARCH_HINTS } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";

const WINDOW_DAYS = 14;
// Shown to every shopper, so a search only counts once several signed-in people made it: nobody's own query (and no
// guest repeating one) leaks into the bar
const MIN_SEARCHERS = 3;

/**
 * What the Home search bar cycles through: the live festival's aisles first, then the store's most searched terms
 * that found something, topped up with everyday searches.
 */
export async function searchHints(prisma: PrismaClient, storeId: string, festivalTerms: string[], now: Date) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const rows = await prisma.$queryRaw<{ term: string }[]>`
    SELECT lower(trim(query)) AS term FROM search_logs
    WHERE store_id = ${storeId} AND created_at >= ${since} AND result_count > 0 AND char_length(trim(query)) BETWEEN 3 AND 24
      AND trim(query) !~ '[0-9]{4,}'
    GROUP BY lower(trim(query))
    HAVING COUNT(DISTINCT user_id) >= ${MIN_SEARCHERS}
    ORDER BY COUNT(*) DESC
    LIMIT ${MAX_SEARCH_HINTS}`;
  const terms = [...festivalTerms.map((t) => t.toLowerCase()), ...rows.map((r) => r.term), ...DEFAULT_SEARCH_HINTS];
  return [...new Set(terms)].slice(0, MAX_SEARCH_HINTS);
}
