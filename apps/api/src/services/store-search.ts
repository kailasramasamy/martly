import type { Prisma, PrismaClient } from "../../generated/prisma/index.js";
import { SearchSortBy, ownBrandId } from "@martly/shared/constants";
import { searchProducts } from "./search.js";
import { brandPickOf, markBrandPicks, storeBrandBoost, type BrandBoost } from "./brand-boost.js";
import { liveSponsored } from "./sponsored.js";
import { namesBrand, placeSearchAds } from "./sponsored-search.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "./store-product-view.js";
import { storeBrandLabel } from "./store-brand-names.js";

const MAX_TAG_TABS = 8;
const MAX_SUBCATEGORY_TABS = 10;

export interface StoreSearchParams {
  q: string;
  tag?: string;
  subcategoryId?: string;
  brandIds?: string[];
  size?: string;
  foodType?: string;
  hasDiscount?: boolean;
  sortBy: SearchSortBy;
  exact?: boolean;
}

export interface SearchFacets {
  tags: { tag: string; count: number; imageUrl: string | null }[];
  // label: the name minus the searched words ("detergent" → Liquid · Powder · Bar), for the tab row
  subcategories: { id: string; name: string; label: string; count: number; imageUrl: string | null }[];
  brands: { id: string; name: string; count: number; imageUrl: string | null }[];
  sizes: { label: string; count: number }[];
  offerCount: number;
}

/** Count distinct products per key; a product yielding several keys counts once per key. */
function countProducts<K>(rows: StoreProductView[], keysOf: (row: StoreProductView) => K[]) {
  const seen = new Map<K, Set<string>>();
  for (const row of rows) {
    for (const key of keysOf(row)) {
      const ids = seen.get(key) ?? new Set<string>();
      ids.add(row.productId);
      seen.set(key, ids);
    }
  }
  return [...seen].map(([key, ids]) => ({ key, count: ids.size })).sort((a, b) => b.count - a.count);
}

function tagFacets(rows: StoreProductView[]): SearchFacets["tags"] {
  return countProducts(rows, (r) => r.product.tags).slice(0, MAX_TAG_TABS).map(({ key, count }) => ({
    tag: key,
    count,
    imageUrl: rows.find((r) => r.product.tags.includes(key) && r.product.imageUrl)?.product.imageUrl ?? null,
  }));
}

const LABEL_FILLERS = /^(?:&|and|-|,|\/)\s*|\s*(?:&|and|-|,|\/)$/gi;

function shortLabel(name: string, queryWords: string[]): string {
  const matches = (w: string) => queryWords.some((q) => w.toLowerCase().replace(/[()]/g, "").startsWith(q) || q.startsWith(w.toLowerCase()));
  const words = name.split(/\s+/);
  if (!words.some(matches)) return name;
  const rest = name
    .replace(/\s*\([^)]*\)/g, (m) => (m.split(/[\s()]+/).filter(Boolean).some(matches) ? "" : m))
    .split(/\s+/).filter((w) => !matches(w)).join(" ")
    .replace(LABEL_FILLERS, "").trim();
  return rest.replace(/[^a-z]/gi, "").length >= 3 ? rest : name;
}

// Short labels only when they stay unique; otherwise the full names avoid two identical tabs
function withShortLabels(facets: Omit<SearchFacets["subcategories"][number], "label">[], query: string) {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const labels = facets.map((f) => shortLabel(f.name, queryWords));
  const unique = new Set(labels.map((l) => l.toLowerCase())).size === labels.length;
  return facets.map((f, i) => ({ ...f, label: unique ? labels[i] : f.name }));
}

// In relevance order, so the subcategories that best match the query lead the row
function subcategoryFacets(ranked: StoreProductView[], query: string): SearchFacets["subcategories"] {
  const counts = countProducts(ranked, (r) => (r.product.subcategory ? [r.product.subcategory.id] : []));
  const countOf = new Map(counts.map(({ key, count }) => [key, count]));
  const facets = new Map<string, Omit<SearchFacets["subcategories"][number], "label">>();
  for (const { product } of ranked) {
    const sub = product.subcategory;
    if (!sub || facets.has(sub.id)) continue;
    facets.set(sub.id, { id: sub.id, name: sub.name, count: countOf.get(sub.id)!, imageUrl: product.imageUrl ?? sub.imageUrl });
  }
  return withShortLabels([...facets.values()].slice(0, MAX_SUBCATEGORY_TABS), query);
}

type OwnBrandStore = { id: string; name: string; logoUrl: string | null };

const isOwn = (row: StoreProductView, boost: BrandBoost) => brandPickOf(row, boost) === "OWN";

/** The store's own chip (its brands and its own staple packs, under its logo) first, then every other brand */
function brandFacets(rows: StoreProductView[], boost: BrandBoost, store: OwnBrandStore): SearchFacets["brands"] {
  const own = countProducts(rows.filter((r) => isOwn(r, boost)), () => [ownBrandId(store.id)])
    .map(({ key, count }) => ({ id: key, count, name: storeBrandLabel(store.id, store.name), imageUrl: store.logoUrl }));
  const others = countProducts(rows.filter((r) => !isOwn(r, boost)), (r) => (r.product.brand ? [r.product.brand.id] : []))
    .map(({ key, count }) => {
      const brand = rows.find((r) => r.product.brandId === key)!.product.brand!;
      return { id: key, count, name: brand.name, imageUrl: brand.imageUrl };
    });
  return [...own, ...others];
}

function filterFacets(rows: StoreProductView[], boost: BrandBoost, store: OwnBrandStore): Omit<SearchFacets, "tags" | "subcategories"> {
  return {
    brands: brandFacets(rows, boost, store),
    sizes: countProducts(rows, (r) => [r.variant.name]).map(({ key, count }) => ({ label: key, count })),
    offerCount: new Set(rows.filter((r) => r.pricing.discountActive).map((r) => r.productId)).size,
  };
}

function applyFilters(rows: StoreProductView[], params: StoreSearchParams, boost: BrandBoost, storeId: string) {
  const brandIds = params.brandIds?.length ? new Set(params.brandIds) : null;
  const brandMatch = (r: StoreProductView) =>
    (r.product.brandId !== null && brandIds!.has(r.product.brandId)) || (brandIds!.has(ownBrandId(storeId)) && isOwn(r, boost));
  return rows.filter((r) =>
    (!brandIds || brandMatch(r)) &&
    (!params.size || r.variant.name === params.size) &&
    (!params.foodType || r.product.foodType === params.foodType) &&
    (!params.hasDiscount || r.pricing.discountActive));
}

/** Group rows by product and order products by the chosen sort, falling back to search relevance. */
function sortByProduct(rows: StoreProductView[], sortBy: SearchSortBy, rank: Map<string, number>) {
  const groups = new Map<string, StoreProductView[]>();
  for (const row of rows) groups.set(row.productId, [...(groups.get(row.productId) ?? []), row]);

  const minPrice = (g: StoreProductView[]) => Math.min(...g.map((r) => r.pricing.effectivePrice));
  const maxSaving = (g: StoreProductView[]) => Math.max(...g.map((r) => r.pricing.savingsPercent));
  const relevance = (g: StoreProductView[]) => rank.get(g[0].productId) ?? Number.MAX_SAFE_INTEGER;
  const primary: Record<SearchSortBy, (a: StoreProductView[], b: StoreProductView[]) => number> = {
    relevance: () => 0,
    price_asc: (a, b) => minPrice(a) - minPrice(b),
    price_desc: (a, b) => minPrice(b) - minPrice(a),
    discount: (a, b) => maxSaving(b) - maxSaving(a),
  };
  return [...groups.values()]
    .sort((a, b) => primary[sortBy](a, b) || relevance(a) - relevance(b))
    .flat();
}

/**
 * Text search within a store. Returns the whole ranked match set (search caps it), facets for the
 * tab row (subcategories, or tags when the matches sit in one subcategory) and filter controls, and the
 * search strategy meta. Tab facets ignore every other filter so the tab row stays stable; filter facets
 * reflect the selected tab. Relevance-sorted results carry up to two sponsored products that matched,
 * unless the query names a brand or the shopper filtered by one.
 */
export async function searchStoreProducts(prisma: PrismaClient, store: { id: string; organizationId: string }, params: StoreSearchParams) {
  const storeId = store.id;
  const [boost, own] = await Promise.all([
    storeBrandBoost(prisma, storeId),
    prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { id: true, name: true, logoUrl: true } }),
  ]);
  const { productIds, meta } = await searchProducts(prisma, storeId, params.q, { exact: params.exact, boost });
  const productWhere: Prisma.ProductWhereInput = productIds.length > 0
    ? { id: { in: productIds } }
    : { name: { contains: params.q, mode: "insensitive" } };

  const rows = await decorateStoreProducts(prisma, await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, product: productWhere },
    include: storeProductInclude,
    orderBy: { product: { name: "asc" } },
  }));

  const rank = new Map(productIds.map((id, i) => [id, i]));
  const ranked = sortByProduct(rows, SearchSortBy.RELEVANCE, rank);
  const inTag = ranked.filter((r) =>
    (!params.tag || r.product.tags.includes(params.tag)) &&
    (!params.subcategoryId || r.product.subcategoryId === params.subcategoryId));
  const facets: SearchFacets = { tags: tagFacets(ranked), subcategories: subcategoryFacets(ranked, meta.correctedQuery ?? params.q), ...filterFacets(inTag, boost, own) };
  const data = markBrandPicks(sortByProduct(applyFilters(inTag, params, boost, storeId), params.sortBy, rank), boost);
  const query = meta.correctedQuery ?? params.q;
  const adFree = params.sortBy !== SearchSortBy.RELEVANCE || params.brandIds?.length || namesBrand(query, facets.brands.map((b) => b.name));
  return { data: adFree ? data : placeSearchAds(data, await liveSponsored(prisma, store), query), facets, searchMeta: meta };
}
