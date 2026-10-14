import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import Anthropic from "@anthropic-ai/sdk";
import { correctQuery } from "./spell.js";

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
// Brand turns are weighted: a brand's n-th product scores n × (BRAND_TURN_BASE − popularity), so a 100-popularity
// leader gets a slot every 20 points and a 50-popularity brand every 70. Intent-only products (aisle match, name
// doesn't contain the query) carry a penalty so "razor" shows razors before the aisle's shaving brushes.
const BRAND_TURN_BASE = 120;
const INTENT_ONLY_PENALTY = 40;

const inStore = (storeId: string) => Prisma.sql`EXISTS (
  SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active = true
)`;

export function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
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
  { minResults = 3, exact = false }: { minResults?: number; exact?: boolean } = {},
): Promise<SearchResult> {
  const q = normalizeQuery(query);
  if (!q) return { productIds: [], meta: { strategy: "keyword" } };

  // Step 1: Keyword match
  const keywordIds = await keywordSearch(prisma, q, storeId);
  if (keywordIds.length >= minResults || exact) {
    return { productIds: keywordIds, meta: { strategy: "keyword" } };
  }

  // Step 2: Spelling correction, then trigram fuzzy match (catches typos via search_text and aliases)
  const corrected = await correctQuery(prisma, storeId, q);
  if (corrected) {
    const correctedIds = await keywordSearch(prisma, corrected, storeId);
    if (correctedIds.length > keywordIds.length) {
      return { productIds: dedup([...correctedIds, ...keywordIds]), meta: { strategy: "fuzzy", correctedQuery: corrected } };
    }
  }
  const fuzzyIds = await trigramSearch(prisma, q, storeId);
  const mergedAfterFuzzy = dedup([...keywordIds, ...fuzzyIds]);
  if (mergedAfterFuzzy.length >= minResults) {
    return { productIds: mergedAfterFuzzy, meta: { strategy: "fuzzy" } };
  }

  // Step 3: Full-text search (stemming, ranking)
  const ftsIds = await fullTextSearch(prisma, q, storeId);
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
  const expanded = await semanticExpand(prisma, q);
  if (!expanded) {
    return { productIds: [], meta: { strategy: "keyword" } };
  }

  // Re-run search with expanded terms
  const expandedIds: string[] = [];
  for (const term of expanded) {
    const kw = await keywordSearch(prisma, term, storeId);
    const tg = await trigramSearch(prisma, term, storeId);
    const ft = await fullTextSearch(prisma, term, storeId);
    expandedIds.push(...kw, ...tg, ...ft);
  }

  return {
    productIds: dedup(expandedIds),
    meta: { strategy: "semantic", expandedTerms: expanded },
  };
}

// Brands with their lowercased name minus the maker ("Surf Excel (HUL)" → "surf excel"), computed once per brand
export const brandNamesCte = Prisma.sql`brand_names AS MATERIALIZED (
  SELECT id, name, popularity, lower(regexp_replace(name, '\\s*\\([^)]*\\)', '', 'g')) AS clean FROM brands
)`;

/**
 * The name a query is matched against. A query naming the brand ("surf exc") sees name + brand, so every product of
 * the brand matches; any other query sees the name minus its leading brand ("Bombay Shaving Company Beard Oil" →
 * "Beard Oil"), so a word in a brand's name doesn't make all its products match.
 * Needs products `p` LEFT JOIN brand_names `b` (brandNamesCte).
 */
export const nameForQuery = (q: string) => Prisma.sql`CASE
  WHEN b.name IS NULL THEN p.name
  WHEN starts_with(b.clean, ${q}) OR starts_with(${q}, b.clean) THEN p.name || ' ' || b.name
  WHEN starts_with(lower(p.name), b.clean) THEN substr(p.name, length(b.clean) + 1)
  ELSE p.name
END`;

// Every stocked product with its intent flag, name tier and taxonomy hit for the query
// (needs the `term`, `sales` and brand_names CTEs)
const matchedProducts = (q: string, storeId: string) => Prisma.sql`
  SELECT p.id, p.name, p.brand_id, COALESCE(b.popularity, 0) AS popularity, COALESCE(sales.n, 0) AS sold,
    COALESCE(${q} = ANY(s.search_terms), false) AS intent,
    CASE
      WHEN own.name ~* ('\\m' || term.rx || '\\M') THEN 0
      WHEN own.name ~* ('\\m' || term.rx) THEN 1
      WHEN own.name ILIKE '%' || ${q} || '%' THEN 2
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
  CROSS JOIN LATERAL (SELECT ${nameForQuery(q)} AS name) own
  WHERE p.is_active = true AND ${inStore(storeId)}`;

async function keywordSearch(prisma: PrismaClient, q: string, storeId: string): Promise<string[]> {
  // Intent first: products in a subcategory whose search terms include the query ("shaving" → Razor & Blades),
  // brands taking weighted turns by popularity, each brand leading with its name matches.
  // Then name tiers: 0 whole word, 1 word-start, 2 substring, 3 translated name, 4 description only. Within a tier:
  // category name hit ("oil" → Edible Oils), then subcategory hit (Hair Oil), then brands round-robin
  // (best-known brands take turns more often) so one brand's A–Z run can't fill the top rows.
  const rows = await prisma.$queryRaw<{ id: string; tier: number }[]>`
    WITH term AS (SELECT regexp_replace(${q}, '([^[:alnum:] ])', '\\\\\\1', 'g') AS rx),
    sales AS (
      SELECT oi.product_id, COUNT(*) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED'
      GROUP BY oi.product_id
    ),
    ${brandNamesCte},
    matched AS MATERIALIZED (${matchedProducts(q, storeId)}),
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
    LIMIT ${MAX_KEYWORD_RESULTS}
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

async function trigramSearch(prisma: PrismaClient, q: string, storeId: string): Promise<string[]> {
  // Search both search_text and search_aliases
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    SELECT DISTINCT p.id, GREATEST(
      similarity(p.search_text, ${q}),
      COALESCE((SELECT MAX(similarity(sa.alias, ${q})) FROM search_aliases sa WHERE sa.product_id = p.id), 0)
    ) as score
    FROM products p
    WHERE p.is_active = true AND ${inStore(storeId)}
      AND (
        p.search_text % ${q}
        OR EXISTS (SELECT 1 FROM search_aliases sa WHERE sa.product_id = p.id AND sa.alias % ${q})
      )
    ORDER BY score DESC
    LIMIT 50
  `;
  return rows.map((r) => r.id);
}

async function fullTextSearch(prisma: PrismaClient, q: string, storeId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT p.id, ts_rank(to_tsvector('english', p.search_text), plainto_tsquery('english', ${q})) as rank
    FROM products p
    WHERE p.is_active = true AND ${inStore(storeId)}
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
