import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { brandNamesCte, nameForQuery, normalizeQuery } from "./search.js";
import { completeQuery, correctQuery } from "./spell.js";
import { liveSponsored } from "./sponsored.js";
import { namesBrand, rotateAds } from "./sponsored-search.js";

export type SuggestionKind = "query" | "category" | "brand";

export interface Suggestion {
  text: string;
  kind: SuggestionKind;
  imageUrl: string | null;
  /** A paid row: a sponsored product the term matches, marked "Ad"; its banner counts the views and taps */
  sponsored?: { bannerId: string };
}

const MAX_SUGGESTIONS = 8;
const POPULAR_LIMIT = 3;
const CATEGORY_LIMIT = 4;
const BRAND_LIMIT = 3;
// Shorter terms say too little to match an ad against
const MIN_AD_TERM = 3;
// Display name without the maker in brackets: "Surf Excel (HUL)" → "Surf Excel"
const MAKER_SUFFIX = "\\s*\\([^)]*\\)";

const escapeRx = (t: string) => t.replace(/[^a-z0-9]/g, (c) => `\\${c}`);
const escapeLike = (t: string) => t.replace(/[%_\\]/g, "\\$&");

// Every word of the term must start a word in `text` — "amul gh…" matches "Amul Pure Ghee"
function allWords(text: Prisma.Sql, tokens: string[], wholeWord = false) {
  return Prisma.join(tokens.map((t) => Prisma.sql`${text} ~* ${`\\m${escapeRx(t)}${wholeWord ? "\\M" : ""}`}`), " AND ");
}

const productText = Prisma.sql`(p.name || ' ' || COALESCE(b.name, ''))`;
const stocked = (storeId: string) => Prisma.sql`EXISTS (
  SELECT 1 FROM store_products sp WHERE sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active = true AND sp.stock > 0
)`;

// Photo for a query row: prefer a product whose subcategory is about the term ("milk" → a milk pack, not milk bread)
async function productImage(prisma: PrismaClient, storeId: string, tokens: string[]) {
  const rows = await prisma.$queryRaw<{ imageUrl: string | null }[]>`
    SELECT p.image_url AS "imageUrl" FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.is_active AND p.image_url IS NOT NULL AND ${allWords(productText, tokens)} AND ${stocked(storeId)}
    ORDER BY (s.name IS NOT NULL AND ${allWords(Prisma.sql`s.name`, tokens, true)}) DESC, length(p.name) LIMIT 1`;
  return rows[0]?.imageUrl ?? null;
}

// What other customers at this store searched that starts with the term
async function popularQueries(prisma: PrismaClient, storeId: string, term: string) {
  return prisma.$queryRaw<{ text: string }[]>`
    SELECT query AS text FROM search_logs
    WHERE store_id = ${storeId} AND result_count > 0 AND created_at > now() - interval '30 days'
      AND query LIKE ${`${escapeLike(term)}%`} AND query <> ${term}
    GROUP BY query ORDER BY COUNT(*) DESC LIMIT ${POPULAR_LIMIT}`;
}

// Subcategories named like the term ("Liquid Detergent", "Detergent Bar") or whose search terms it starts
// ("shav" → Razor & Blades), with a stocked product's photo
async function categoryMatches(prisma: PrismaClient, storeId: string, term: string, tokens: string[]) {
  return prisma.$queryRaw<{ text: string; imageUrl: string | null }[]>`
    SELECT s.name AS text, img.image_url AS "imageUrl"
    FROM subcategories s
    CROSS JOIN LATERAL (
      SELECT p.image_url FROM products p
      WHERE p.subcategory_id = s.id AND p.is_active AND p.image_url IS NOT NULL AND ${stocked(storeId)} LIMIT 1
    ) img
    WHERE ${allWords(Prisma.sql`s.name`, tokens)}
      OR EXISTS (SELECT 1 FROM unnest(s.search_terms) t WHERE t LIKE ${`${escapeLike(term)}%`})
    ORDER BY (lower(s.name) LIKE ${`${escapeLike(tokens[0])}%`}) DESC, (${term} = ANY(s.search_terms)) DESC,
      ${allWords(Prisma.sql`s.name`, tokens)} DESC, length(s.name)
    LIMIT ${CATEGORY_LIMIT}`;
}

interface BrandRow { brand: string; imageUrl: string | null; subcategories: string[] }

// Best-known brands with products matching every word (or in an aisle the term names), plus each brand's
// subcategories for those products
async function brandRows(prisma: PrismaClient, storeId: string, term: string, tokens: string[]) {
  return prisma.$queryRaw<BrandRow[]>`
    WITH ${brandNamesCte}
    SELECT regexp_replace(b.name, ${MAKER_SUFFIX}, '', 'g') AS brand,
      (ARRAY_AGG(p.image_url ORDER BY length(p.name)) FILTER (WHERE p.image_url IS NOT NULL))[1] AS "imageUrl",
      (ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL))[1:3] AS subcategories
    FROM products p
    JOIN brand_names b ON b.id = p.brand_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.is_active AND ${stocked(storeId)}
      AND (${allWords(nameForQuery(term), tokens, true)} OR ${term} = ANY(s.search_terms))
    GROUP BY b.name
    -- Popularity weighted by how much of the brand matches: a leader with one stray hit ("Cadbury chips") stays out
    ORDER BY MAX(b.popularity) * ln(1 + COUNT(*)) DESC
    LIMIT ${BRAND_LIMIT}`;
}

// "Surf Excel detergent" for a product word; for a brand query, the brand's own ranges ("Surf Excel Liquid Detergent")
// A brand query starts the brand name or starts with it ("surf", "surf excel liquid"), not one inside it ("shaving")
function brandSuggestions(rows: BrandRow[], term: string, tokens: string[]): Suggestion[] {
  return rows.flatMap((r) => {
    const brand = r.brand.toLowerCase();
    const brandWords = brand.split(/\s+/);
    const rest = tokens.filter((t) => !brandWords.some((w) => w.startsWith(t)));
    if (rest.length > 0) return [{ text: `${r.brand} ${rest.join(" ")}`, kind: "brand" as const, imageUrl: r.imageUrl }];
    if (!(brand.startsWith(term) || term.startsWith(brand))) return [{ text: r.brand, kind: "brand" as const, imageUrl: r.imageUrl }];
    return [
      { text: r.brand, kind: "brand" as const, imageUrl: r.imageUrl },
      ...r.subcategories.map((s) => ({ text: `${r.brand} ${s}`, kind: "category" as const, imageUrl: r.imageUrl })),
    ];
  });
}

/**
 * One sponsored product whose name (or aisle) the term matches, unless the term names a brand: its name becomes the
 * row, so tapping it searches for that product.
 */
async function sponsoredSuggestion(prisma: PrismaClient, store: { id: string; organizationId: string }, term: string, tokens: string[], brands: BrandRow[]) {
  if (term.length < MIN_AD_TERM || namesBrand(term, brands.map((b) => b.brand))) return null;
  const ads = await liveSponsored(prisma, store);
  if (ads.length === 0) return null;
  const matching = await prisma.$queryRaw<{ id: string; name: string; imageUrl: string | null }[]>`
    WITH ${brandNamesCte}
    SELECT p.id, p.name, p.image_url AS "imageUrl" FROM products p
    LEFT JOIN brand_names b ON b.id = p.brand_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.id IN (${Prisma.join(ads.map((a) => a.productId))})
      AND (${allWords(nameForQuery(term), tokens)} OR ${term} = ANY(s.search_terms))`;
  const byId = new Map(matching.map((m) => [m.id, m]));
  const ad = rotateAds(ads.filter((a) => byId.has(a.productId)), term)[0];
  if (!ad) return null;
  const product = byId.get(ad.productId)!;
  return { text: product.name, kind: "query" as const, imageUrl: product.imageUrl, sponsored: { bannerId: ad.bannerId } };
}

function dedupe(candidates: Suggestion[]) {
  const seen = new Set<string>();
  return candidates.filter((s) => {
    const key = s.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_SUGGESTIONS);
}

/**
 * Typeahead for one store: the (spell-corrected, completed) term, popular searches, matching subcategories
 * and brand suggestions — only things the store has in stock, so no suggestion leads to an empty page.
 */
export async function suggestSearches(prisma: PrismaClient, store: { id: string; organizationId: string }, rawQuery: string) {
  const storeId = store.id;
  const q = normalizeQuery(rawQuery);
  const completed = await completeQuery(prisma, storeId, q);
  const termImage = await productImage(prisma, storeId, completed.split(" "));
  const correctedQuery = termImage ? undefined : await correctQuery(prisma, storeId, q);
  const term = correctedQuery ?? completed;
  const tokens = term.split(" ");
  const [image, popular, categories, brands] = await Promise.all([
    correctedQuery ? productImage(prisma, storeId, tokens) : Promise.resolve(termImage),
    popularQueries(prisma, storeId, term),
    categoryMatches(prisma, storeId, term, tokens),
    brandRows(prisma, storeId, term, tokens),
  ]);
  const popularRows = await Promise.all(popular.map(async (p) => ({
    text: p.text, kind: "query" as const, imageUrl: await productImage(prisma, storeId, p.text.split(" ")),
  })));
  const ad = await sponsoredSuggestion(prisma, store, term, tokens, brands);
  const suggestions = dedupe([
    // The term itself only earns a row when something in the store matches it; the ad sits right after it
    ...(image ? [{ text: term, kind: "query" as const, imageUrl: image }] : []),
    ...(ad ? [ad] : []),
    ...popularRows,
    ...categories.map((c) => ({ text: c.text, kind: "category" as const, imageUrl: c.imageUrl })),
    ...brandSuggestions(brands, term, tokens),
  ]);
  return { suggestions, correctedQuery };
}
