import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import Anthropic from "@anthropic-ai/sdk";
import { correctQuery } from "./spell.js";
import { hasBoost, storeBrandBoost, type BrandBoost } from "./brand-boost.js";
import type { BrandPick } from "@martly/shared/constants";

export type SearchStrategy = "keyword" | "fuzzy" | "fulltext" | "semantic";

export interface SearchMeta {
  strategy: SearchStrategy;
  correctedQuery?: string;
  expandedTerms?: string[];
}

export interface SearchResult {
  productIds: string[];
  meta: SearchMeta;
}

// In-memory cache for semantic expansions (5-minute TTL)
const semanticCache = new Map<string, { terms: string[]; expiry: number }>();

const MAX_KEYWORD_RESULTS = 200;
// Admins page through every match (a brand can have hundreds of products), so the ranked list runs deeper
const MAX_ADMIN_RESULTS = 2000;
// Brand turns are weighted: a brand's n-th product scores n × (BRAND_TURN_BASE − popularity), so a 100-popularity
// leader gets a slot every 20 points and a 50-popularity brand every 70. Intent-only products (aisle match, name
// doesn't contain the query) carry a penalty so "razor" shows razors before the aisle's shaving brushes.
const BRAND_TURN_BASE = 120;
const INTENT_ONLY_PENALTY = 40;
// Featured brands take turns just ahead of a 100-popularity leader (every 15 points); the store's own brand and
// staples a little more often (every 14), so they lead when both match
const FEATURED_POPULARITY = 105;
const OWN_POPULARITY = 106;

/**
 * What a search runs over. Shoppers see a store's listed, active products; admins also see unlisted listings
 * (store scope) or the whole catalog (no storeId), including inactive products. A collection narrows it to its items.
 */
interface SearchScope {
  storeId?: string;
  listedOnly?: boolean;
  collectionId?: string;
  /** What the store promotes: own brands and unbranded staples (OWN_POPULARITY), featured brands (FEATURED_POPULARITY) */
  boost?: BrandBoost;
}

const inScope = ({ storeId, listedOnly, collectionId }: SearchScope) => {
  const store = inStoreScope({ storeId, listedOnly });
  return collectionId
    ? Prisma.sql`${store} AND EXISTS (SELECT 1 FROM collection_items ci WHERE ci.collection_id = ${collectionId} AND ci.product_id = p.id)`
    : store;
};

const inStoreScope = ({ storeId, listedOnly }: SearchScope) => {
  if (!storeId) return Prisma.sql`TRUE`;
  return listedOnly
    ? Prisma.sql`p.is_active = true AND EXISTS (
        SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active = true)`
    : Prisma.sql`EXISTS (SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${storeId})`;
};

const salesScope = ({ storeId }: SearchScope) => (storeId ? Prisma.sql`o.store_id = ${storeId}` : Prisma.sql`TRUE`);

interface SearchOptions {
  minResults?: number;
  exact?: boolean;
  /** LLM query expansion as a last resort — shoppers only */
  semantic?: boolean;
  limit?: number;
}

export function normalizeQuery(q: string): string {
  // Apostrophes are dropped on both sides so "lays" and "lay's" both find "Lay's"
  return q.toLowerCase().replace(/['\u2019`]/g, "").trim().replace(/\s+/g, " ");
}

/**
 * Multi-strategy product search over the products a store stocks:
 * 1. Keyword match (contains) — if ≥3 results, return
 *    `exact` stops here: the customer chose "Search instead for <what I typed>"
 * 2. Spell-corrected keyword match ("deterget" → "detergent") — reported as correctedQuery
 *    then trigram fuzzy match (pg_trgm) over whole names
 * 3. Full-text search (tsvector) — stemming, ranking
 * 4. Semantic expansion via Claude Haiku — only if steps 1-3 return <3 results
 */
export async function searchProducts(
  prisma: PrismaClient,
  storeId: string,
  query: string,
  { minResults = 3, exact = false, boost }: { minResults?: number; exact?: boolean; boost?: BrandBoost } = {},
): Promise<SearchResult> {
  const promoted = boost ?? await storeBrandBoost(prisma, storeId);
  return runSearch(prisma, { storeId, listedOnly: true, boost: promoted }, query, { minResults, exact, semantic: true, limit: MAX_KEYWORD_RESULTS });
}

/** Same ranking within one collection's products, for a campaign screen's search; no LLM expansion as it runs per keystroke */
export function searchCollectionProducts(prisma: PrismaClient, storeId: string, collectionId: string, query: string): Promise<SearchResult> {
  return runSearch(prisma, { storeId, listedOnly: true, collectionId }, query, { semantic: false, limit: MAX_KEYWORD_RESULTS });
}

/** Same ranking for the Manage persona: unlisted listings / whole catalog, no LLM expansion, deeper result list */
export function searchProductsForAdmin(prisma: PrismaClient, scope: { storeId?: string }, query: string): Promise<SearchResult> {
  return runSearch(prisma, { storeId: scope.storeId, listedOnly: false }, query, { semantic: false, limit: MAX_ADMIN_RESULTS });
}

async function runSearch(prisma: PrismaClient, scope: SearchScope, query: string, opts: SearchOptions): Promise<SearchResult> {
  const { minResults = 3, exact = false, semantic = false, limit = MAX_KEYWORD_RESULTS } = opts;
  const q = normalizeQuery(query);
  if (!q) return { productIds: [], meta: { strategy: "keyword" } };

  // Step 1: Keyword match
  const keywordIds = await keywordSearch(prisma, q, scope, limit);
  if (keywordIds.length >= minResults || exact) {
    return { productIds: keywordIds, meta: { strategy: "keyword" } };
  }

  // Step 2: Spelling correction (vocabulary is per store), then trigram fuzzy match (catches typos via search_text and aliases)
  const corrected = await correctQuery(prisma, scope.storeId, q);
  if (corrected) {
    const correctedIds = await keywordSearch(prisma, corrected, scope, limit);
    if (correctedIds.length > keywordIds.length) {
      return { productIds: dedup([...correctedIds, ...keywordIds]), meta: { strategy: "fuzzy", correctedQuery: corrected } };
    }
  }
  const fuzzyIds = await trigramSearch(prisma, q, scope);
  const mergedAfterFuzzy = dedup([...keywordIds, ...fuzzyIds]);
  if (mergedAfterFuzzy.length >= minResults) {
    return { productIds: mergedAfterFuzzy, meta: { strategy: "fuzzy" } };
  }

  // Step 3: Full-text search (stemming, ranking)
  const ftsIds = await fullTextSearch(prisma, q, scope);
  const mergedAfterFts = dedup([...mergedAfterFuzzy, ...ftsIds]);
  if (mergedAfterFts.length >= minResults) {
    return { productIds: mergedAfterFts, meta: { strategy: "fulltext" } };
  }

  // If we found something (1-2 results) via fuzzy/FTS, return it — no need for LLM
  if (mergedAfterFts.length > 0) {
    const strategy: SearchStrategy = fuzzyIds.length > 0 ? "fuzzy" : "fulltext";
    return { productIds: mergedAfterFts, meta: { strategy } };
  }

  // Step 4: Semantic expansion via LLM (only when 0 results from all DB strategies)
  const expanded = semantic ? await semanticExpand(prisma, q) : null;
  if (!expanded) {
    return { productIds: [], meta: { strategy: "keyword" } };
  }

  // Re-run search with expanded terms
  const expandedIds: string[] = [];
  for (const term of expanded) {
    const kw = await keywordSearch(prisma, term, scope, limit);
    const tg = await trigramSearch(prisma, term, scope);
    const ft = await fullTextSearch(prisma, term, scope);
    expandedIds.push(...kw, ...tg, ...ft);
  }

  return {
    productIds: dedup(expandedIds),
    meta: { strategy: "semantic", expandedTerms: expanded },
  };
}

// Brands with their lowercased name minus the maker ("Surf Excel (HUL)" → "surf excel"), computed once per brand
export const brandNamesCte = Prisma.sql`brand_names AS MATERIALIZED (
  SELECT id, name, popularity,
    regexp_replace(lower(regexp_replace(name, '\\s*\\([^)]*\\)', '', 'g')), '[''\u2019]', '', 'g') AS clean FROM brands
)`;

/**
 * The name a query is matched against. A query naming the brand sees name + brand, so every product of the brand
 * matches — from any word, so a sub-brand finds its house-branded range ("fab" → Godrej Fab, "surf exc" → Surf Excel);
 * any other query sees the name minus its leading brand ("Godrej Fab Front Load" → "Front Load"), so the brand's
 * products only match on their own words.
 * Needs products `p` LEFT JOIN brand_names `b` (brandNamesCte).
 */
export const nameForQuery = (q: string) => Prisma.sql`CASE
  WHEN b.name IS NULL THEN p.name
  WHEN b.clean ~ ('\\m' || regexp_replace(${q}, '([^[:alnum:] ])', '\\\\\\1', 'g')) OR starts_with(${q}, b.clean)
    THEN p.name || ' ' || b.name
  WHEN starts_with(lower(p.name), b.clean) THEN substr(p.name, length(b.clean) + 1)
  ELSE p.name
END`;

const brandsPicked = (boost: BrandBoost, pick: BrandPick) => [...boost.brands].filter(([, p]) => p === pick).map(([id]) => id);

// Unbranded staples take their turns together, like one store brand
const popularity = ({ boost }: SearchScope) => (boost && hasBoost(boost)
  ? Prisma.sql`CASE
      WHEN p.brand_id = ANY(${brandsPicked(boost, "OWN")}::text[])
        OR (p.brand_id IS NULL AND p.subcategory_id = ANY(${boost.stapleSubcategoryIds}::text[])) THEN ${OWN_POPULARITY}
      WHEN p.brand_id = ANY(${brandsPicked(boost, "FEATURED")}::text[]) THEN ${FEATURED_POPULARITY}
      ELSE COALESCE(b.popularity, 0) END`
  : Prisma.sql`COALESCE(b.popularity, 0)`);

// Every stocked product with its intent flag, name tier and taxonomy hit for the query
// (needs the `term`, `sales` and brand_names CTEs)
const matchedProducts = (q: string, scope: SearchScope) => Prisma.sql`
  SELECT p.id, p.name, p.brand_id, ${popularity(scope)} AS popularity, COALESCE(sales.n, 0) AS sold,
    COALESCE(${q} = ANY(s.search_terms), false) AS intent,
    CASE
      WHEN own.name ~* ('\\m' || term.rx || '\\M') THEN 0
      WHEN own.name ~* ('\\m' || term.rx) THEN 1
      WHEN own.name ILIKE '%' || ${q} || '%'
        OR (SELECT bool_and(own.name ~* ('\\m' || w)) FROM unnest(term.words) w) THEN 2
      WHEN EXISTS (
        SELECT 1 FROM jsonb_each(COALESCE(p.translations, '{}'::jsonb)) t
        WHERE t.value->>'name' ILIKE '%' || ${q} || '%'
      ) THEN 3
      WHEN p.description ILIKE '%' || ${q} || '%' THEN 4
    END AS tier,
    CASE
      WHEN c.name ~* ('\\m' || term.rx) THEN 0
      WHEN s.name ~* ('\\m' || term.rx) THEN 1
      ELSE 2
    END AS taxonomy
  FROM products p
  CROSS JOIN term
  LEFT JOIN brand_names b ON b.id = p.brand_id
  LEFT JOIN subcategories s ON s.id = p.subcategory_id
  LEFT JOIN categories c ON c.id = s.category_id
  LEFT JOIN sales ON sales.product_id = p.id
  CROSS JOIN LATERAL (SELECT regexp_replace(${nameForQuery(q)}, '[''\u2019]', '', 'g') AS name) own
  WHERE ${inScope(scope)}`;

async function keywordSearch(prisma: PrismaClient, q: string, scope: SearchScope, limit: number): Promise<string[]> {
  // Intent first: products in a subcategory whose search terms include the query ("shaving" → Razor & Blades),
  // brands taking weighted turns by popularity, each brand leading with its name matches.
  // Then name tiers: 0 whole word, 1 word-start, 2 substring, 3 translated name, 4 description only. Within a tier:
  // category name hit ("oil" → Edible Oils), then subcategory hit (Hair Oil), then brands round-robin
  // (best-known brands take turns more often) so one brand's A–Z run can't fill the top rows.
  const rows = await prisma.$queryRaw<{ id: string; tier: number }[]>`
    WITH term AS (
      SELECT rx, string_to_array(rx, ' ') AS words
      FROM (SELECT regexp_replace(${q}, '([^[:alnum:] ])', '\\\\\\1', 'g') AS rx) e
    ),
    sales AS (
      SELECT oi.product_id, COUNT(*) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE ${salesScope(scope)} AND o.status <> 'CANCELLED'
      GROUP BY oi.product_id
    ),
    ${brandNamesCte},
    matched AS MATERIALIZED (${matchedProducts(q, scope)}),
    banded AS (
      SELECT *,
        CASE WHEN intent THEN 0 ELSE 1 END AS band,
        CASE WHEN intent THEN 0 ELSE tier END AS band_tier,
        CASE WHEN intent THEN 0 ELSE taxonomy END AS band_taxonomy
      FROM matched WHERE intent OR tier IS NOT NULL
    )
    SELECT id, CASE WHEN intent THEN 0 ELSE tier END AS tier FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY band, band_tier, band_taxonomy, brand_id ORDER BY tier NULLS LAST, sold DESC, name
      ) AS brand_round
      FROM banded
    ) m
    ORDER BY band, band_tier, band_taxonomy,
      brand_round * (${BRAND_TURN_BASE} - popularity) + CASE WHEN intent AND tier IS NULL THEN ${INTENT_ONLY_PENALTY} ELSE 0 END,
      popularity DESC, sold DESC, name
    LIMIT ${limit}
  `;
  return tightestTier(rows).map((r) => r.id);
}

// Prefer whole-word name hits ("dal" → not "Dalda"), then any name hit, before falling back to everything
function tightestTier<T extends { tier: number }>(rows: T[]): T[] {
  for (const maxTier of [0, 3]) {
    const hits = rows.filter((r) => r.tier <= maxTier);
    if (hits.length >= 3) return hits;
  }
  return rows;
}

async function trigramSearch(prisma: PrismaClient, q: string, scope: SearchScope): Promise<string[]> {
  // Search both search_text and search_aliases
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    SELECT DISTINCT p.id, GREATEST(
      similarity(p.search_text, ${q}),
      COALESCE((SELECT MAX(similarity(sa.alias, ${q})) FROM search_aliases sa WHERE sa.product_id = p.id), 0)
    ) as score
    FROM products p
    WHERE ${inScope(scope)}
      AND (
        p.search_text % ${q}
        OR EXISTS (SELECT 1 FROM search_aliases sa WHERE sa.product_id = p.id AND sa.alias % ${q})
      )
    ORDER BY score DESC
    LIMIT 50
  `;
  return rows.map((r) => r.id);
}

async function fullTextSearch(prisma: PrismaClient, q: string, scope: SearchScope): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT p.id, ts_rank(to_tsvector('english', p.search_text), plainto_tsquery('english', ${q})) as rank
    FROM products p
    WHERE ${inScope(scope)}
      AND to_tsvector('english', p.search_text) @@ plainto_tsquery('english', ${q})
    ORDER BY rank DESC
    LIMIT 50
  `;
  return rows.map((r) => r.id);
}

async function semanticExpand(prisma: PrismaClient, query: string): Promise<string[] | null> {
  const normalized = normalizeQuery(query);

  // Check cache
  const cached = semanticCache.get(normalized);
  if (cached && cached.expiry > Date.now()) {
    return cached.terms;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    // Fetch available categories to ground the LLM response
    const subcategories = await prisma.subcategory.findMany({
      select: { name: true },
      take: 200,
    });
    const categoryNames = subcategories.map((c) => c.name).join(", ");

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are a grocery search assistant for an Indian grocery store. Convert this search query into specific product keywords that would match actual grocery products.

Available categories: ${categoryNames}

Search query: "${query}"

Return ONLY a JSON array of 3-5 specific product search terms. Examples:
- "healthy breakfast" → ["muesli", "oats", "cornflakes", "granola", "poha"]
- "something for kids lunch" → ["bread", "cheese", "jam", "peanut butter", "juice"]
- "party snacks" → ["chips", "namkeen", "biscuits", "cold drinks", "nuts"]

JSON array:`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\[.*\]/s);
    if (!match) return null;

    const terms: string[] = JSON.parse(match[0]);
    if (!Array.isArray(terms) || terms.length === 0) return null;

    // Cache for 5 minutes
    semanticCache.set(normalized, { terms, expiry: Date.now() + 5 * 60 * 1000 });

    return terms;
  } catch {
    return null;
  }
}

function dedup(ids: string[]): string[] {
  return [...new Set(ids)];
}
