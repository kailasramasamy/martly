import type { PrismaClient } from "../../generated/prisma/index.js";
import Anthropic from "@anthropic-ai/sdk";

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

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Multi-strategy product search:
 * 1. Keyword match (contains) — if ≥3 results, return
 * 2. Trigram fuzzy match (pg_trgm) — catches typos
 * 3. Full-text search (tsvector) — stemming, ranking
 * 4. Semantic expansion via Claude Haiku — only if steps 1-3 return <3 results
 */
export async function searchProducts(
  prisma: PrismaClient,
  query: string,
  minResults = 3,
): Promise<SearchResult> {
  const q = normalizeQuery(query);
  if (!q) return { productIds: [], meta: { strategy: "keyword" } };

  // Step 1: Keyword match
  const keywordIds = await keywordSearch(prisma, q);
  if (keywordIds.length >= minResults) {
    return { productIds: keywordIds, meta: { strategy: "keyword" } };
  }

  // Step 2: Trigram fuzzy match (catches typos via search_text and aliases)
  const fuzzyIds = await trigramSearch(prisma, q);
  const mergedAfterFuzzy = dedup([...keywordIds, ...fuzzyIds]);
  if (mergedAfterFuzzy.length >= minResults) {
    const corrected = fuzzyIds.length > 0 ? await getCorrectedName(prisma, fuzzyIds[0]) : undefined;
    return {
      productIds: mergedAfterFuzzy,
      meta: { strategy: "fuzzy", correctedQuery: corrected },
    };
  }

  // Step 3: Full-text search (stemming, ranking)
  const ftsIds = await fullTextSearch(prisma, q);
  const mergedAfterFts = dedup([...mergedAfterFuzzy, ...ftsIds]);
  if (mergedAfterFts.length >= minResults) {
    return { productIds: mergedAfterFts, meta: { strategy: "fulltext" } };
  }

  // If we found something (1-2 results) via fuzzy/FTS, return it — no need for LLM
  if (mergedAfterFts.length > 0) {
    const corrected = fuzzyIds.length > 0 ? await getCorrectedName(prisma, fuzzyIds[0]) : undefined;
    const strategy: SearchStrategy = fuzzyIds.length > 0 ? "fuzzy" : "fulltext";
    return {
      productIds: mergedAfterFts,
      meta: { strategy, correctedQuery: corrected },
    };
  }

  // Step 4: Semantic expansion via LLM (only when 0 results from all DB strategies)
  const expanded = await semanticExpand(prisma, q);
  if (!expanded) {
    return { productIds: [], meta: { strategy: "keyword" } };
  }

  // Re-run search with expanded terms
  const expandedIds: string[] = [];
  for (const term of expanded) {
    const kw = await keywordSearch(prisma, term);
    const tg = await trigramSearch(prisma, term);
    const ft = await fullTextSearch(prisma, term);
    expandedIds.push(...kw, ...tg, ...ft);
  }

  return {
    productIds: dedup(expandedIds),
    meta: { strategy: "semantic", expandedTerms: expanded },
  };
}

async function keywordSearch(prisma: PrismaClient, q: string): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isActive: true },
    select: { id: true },
    take: 50,
  });
  return products.map((p) => p.id);
}

async function trigramSearch(prisma: PrismaClient, q: string): Promise<string[]> {
  // Search both search_text and search_aliases
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    SELECT DISTINCT p.id, GREATEST(
      similarity(p.search_text, ${q}),
      COALESCE((SELECT MAX(similarity(sa.alias, ${q})) FROM search_aliases sa WHERE sa.product_id = p.id), 0)
    ) as score
    FROM products p
    WHERE p.is_active = true
      AND (
        p.search_text % ${q}
        OR EXISTS (SELECT 1 FROM search_aliases sa WHERE sa.product_id = p.id AND sa.alias % ${q})
      )
    ORDER BY score DESC
    LIMIT 50
  `;
  return rows.map((r) => r.id);
}

async function fullTextSearch(prisma: PrismaClient, q: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string; rank: number }[]>`
    SELECT p.id, ts_rank(to_tsvector('english', p.search_text), plainto_tsquery('english', ${q})) as rank
    FROM products p
    WHERE p.is_active = true
      AND to_tsvector('english', p.search_text) @@ plainto_tsquery('english', ${q})
    ORDER BY rank DESC
    LIMIT 50
  `;
  return rows.map((r) => r.id);
}

async function getCorrectedName(prisma: PrismaClient, productId: string): Promise<string | undefined> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true },
  });
  return product?.name;
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
    const categories = await prisma.category.findMany({
      select: { name: true },
      take: 100,
    });
    const categoryNames = categories.map((c) => c.name).join(", ");

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
