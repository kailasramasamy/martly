import { DEFAULT_SEARCH_HINTS, DEFAULT_SEARCH_HINT_TRANSLATIONS, MAX_SEARCH_HINTS } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";

const WINDOW_DAYS = 14;
// Shown to every shopper, so a search only counts once several signed-in people made it: nobody's own query (and no
// guest repeating one) leaks into the bar
const MIN_SEARCHERS = 3;
// The glossary also keeps romanised phrases (arisi); only one in the language's own script belongs in its bar
const LATIN = /[a-z]/i;

export interface HintTile { title: string; translations: unknown }
/** A hint in English, with what it reads as in other languages */
interface Hint { term: string; translations: Record<string, string> }

function tileHint(tile: HintTile): Hint {
  const own = (tile.translations ?? {}) as Record<string, { title?: string }>;
  const translations = Object.fromEntries(Object.entries(own).flatMap(([lang, t]) => (t.title ? [[lang, t.title]] : [])));
  return { term: tile.title.toLowerCase(), translations };
}

/** The store's most searched terms that found something, each with its list-glossary phrase per language */
async function popularHints(prisma: PrismaClient, storeId: string, now: Date): Promise<Hint[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const rows = await prisma.$queryRaw<{ term: string }[]>`
    SELECT lower(trim(query)) AS term FROM search_logs
    WHERE store_id = ${storeId} AND created_at >= ${since} AND result_count > 0 AND char_length(trim(query)) BETWEEN 3 AND 24
      AND trim(query) !~ '[0-9]{4,}'
    GROUP BY lower(trim(query))
    HAVING COUNT(DISTINCT user_id) >= ${MIN_SEARCHERS}
    ORDER BY COUNT(*) DESC
    LIMIT ${MAX_SEARCH_HINTS}`;
  const glossary = await prisma.listGlossaryTerm.findMany({
    where: { searchTerm: { in: rows.map((r) => r.term), mode: "insensitive" }, isActive: true },
    select: { searchTerm: true, phrases: { select: { language: true, text: true } } },
  });
  const phrasesOf = new Map(glossary.map((g) => [g.searchTerm.toLowerCase(), g.phrases]));
  return rows.map(({ term }) => {
    const translations: Record<string, string> = {};
    for (const p of phrasesOf.get(term) ?? []) if (!LATIN.test(p.text)) translations[p.language] ??= p.text;
    return { term, translations };
  });
}

/**
 * What the Home search bar cycles through: the live festival's aisles first, then the store's most searched terms
 * that found something, topped up with everyday searches. Other languages get the hints that have a translation.
 */
export async function searchHints(prisma: PrismaClient, storeId: string, festivalTiles: HintTile[], now: Date) {
  const everyday = DEFAULT_SEARCH_HINTS.map((term): Hint => ({
    term,
    translations: Object.fromEntries(Object.entries(DEFAULT_SEARCH_HINT_TRANSLATIONS).map(([lang, words]) => [lang, words[term]])),
  }));
  const all = [...festivalTiles.map(tileHint), ...(await popularHints(prisma, storeId, now)), ...everyday];
  const hints = all.filter((h, i) => all.findIndex((o) => o.term === h.term) === i).slice(0, MAX_SEARCH_HINTS);
  const translations: Record<string, string[]> = {};
  for (const lang of Object.keys(DEFAULT_SEARCH_HINT_TRANSLATIONS)) {
    translations[lang] = [...new Set(all.flatMap((h) => (h.translations[lang] ? [h.translations[lang]] : [])))].slice(0, MAX_SEARCH_HINTS);
  }
  return { hints: hints.map((h) => h.term), translations };
}
