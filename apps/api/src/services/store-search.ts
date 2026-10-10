import type { Prisma, PrismaClient } from "../../generated/prisma/index.js";
import { SearchSortBy } from "@martly/shared/constants";
import { searchProducts } from "./search.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "./store-product-view.js";

const MAX_TAG_TABS = 8;

export interface StoreSearchParams {
  q: string;
  tag?: string;
  brandIds?: string[];
  size?: string;
  foodType?: string;
  hasDiscount?: boolean;
  sortBy: SearchSortBy;
}

export interface SearchFacets {
  tags: { tag: string; count: number; imageUrl: string | null }[];
  brands: { id: string; name: string; count: number }[];
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

function filterFacets(rows: StoreProductView[]): Omit<SearchFacets, "tags"> {
  return {
    brands: countProducts(rows, (r) => (r.product.brand ? [r.product.brand.id] : []))
      .map(({ key, count }) => ({ id: key, count, name: rows.find((r) => r.product.brandId === key)!.product.brand!.name })),
    sizes: countProducts(rows, (r) => [r.variant.name]).map(({ key, count }) => ({ label: key, count })),
    offerCount: new Set(rows.filter((r) => r.pricing.discountActive).map((r) => r.productId)).size,
  };
}

function applyFilters(rows: StoreProductView[], params: StoreSearchParams) {
  const brandIds = params.brandIds?.length ? new Set(params.brandIds) : null;
  return rows.filter((r) =>
    (!brandIds || (r.product.brandId !== null && brandIds.has(r.product.brandId))) &&
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
 * tag tabs and filter controls, and the search strategy meta. Tag facets ignore every other filter so
 * the tab row stays stable; filter facets reflect the selected tag.
 */
export async function searchStoreProducts(prisma: PrismaClient, storeId: string, params: StoreSearchParams) {
  const { productIds, meta } = await searchProducts(prisma, params.q);
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
  const inTag = params.tag ? ranked.filter((r) => r.product.tags.includes(params.tag!)) : ranked;
  const facets: SearchFacets = { tags: tagFacets(ranked), ...filterFacets(inTag) };
  const data = sortByProduct(applyFilters(inTag, params), params.sortBy, rank);
  return { data, facets, searchMeta: meta };
}
