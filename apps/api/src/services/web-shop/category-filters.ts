import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { DISCOUNT_TIERS, FoodType, RATING_TIERS, SearchSortBy, type PriceRange } from "@martly/shared/constants";
import type { WebShopQuery } from "@martly/shared/schemas";
import type { WebCategoryFacets, WebCategoryFilters, WebProductCard } from "@martly/shared/types";
import { cardSelect, popularFirst, soldAt, toCard } from "./cards.js";

// Round numbers a price band can start or end on
const BAND_EDGES = [10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
const BAND_QUANTILES = [0.2, 0.4, 0.6, 0.8];

/** A product as the filters see it: its card's cheapest price, best % off, any free-item offer, stock and rating */
interface Item {
  card: WebProductCard;
  brand: { slug: string; name: string } | null;
  foodType: FoodType | null;
  price: number;
  off: number;
  offer: boolean;
  inStock: boolean;
  rating: number | null;
}

// A range takes its min and stops short of its max, so a ₹50 product sits in "₹50 – ₹75", not also in "₹30 – ₹50"
const inRange = (price: number, r: PriceRange) => (r.min === null || price >= r.min) && (r.max === null || price < r.max);

type Group = "brand" | "price" | "off" | "rating" | "offers" | "food" | "stock";

async function loadItems(prisma: PrismaClient, storeId: string, where: Prisma.ProductWhereInput): Promise<Item[]> {
  const rows = await prisma.product.findMany({
    where: { AND: [soldAt(storeId), where] },
    select: { ...cardSelect(storeId), foodType: true, brand: { select: { name: true, slug: true } } },
    orderBy: popularFirst,
  });
  const ratings = rows.length
    ? await prisma.review.groupBy({ by: ["productId"], where: { status: "APPROVED", productId: { in: rows.map((r) => r.id) } }, _avg: { rating: true } })
    : [];
  const ratingOf = new Map(ratings.map((r) => [r.productId, r._avg.rating]));
  return rows.flatMap((row) => {
    const card = toCard(row);
    if (!card.packs.length) return [];
    return [{
      card,
      brand: row.brand,
      foodType: row.foodType,
      price: Math.min(...card.packs.map((p) => p.price)),
      off: Math.max(...card.packs.map((p) => p.offPercent)),
      offer: card.packs.some((p) => p.offer),
      inStock: card.packs.some((p) => p.inStock),
      rating: ratingOf.get(row.id) ?? null,
    }];
  });
}

function filtersOf(q: WebShopQuery): WebCategoryFilters {
  return {
    brand: q.brand, price: q.price, off: q.off ?? null, rating: q.rating ?? null,
    offers: q.offers, food: q.food ?? null, stock: q.stock, sort: q.sort,
  };
}

/** Whether an item passes one group's filter (a group that is off passes everything) */
function passes(item: Item, group: Group, f: WebCategoryFilters): boolean {
  switch (group) {
    case "brand": return !f.brand.length || (!!item.brand && f.brand.includes(item.brand.slug));
    case "price": return !f.price || inRange(item.price, f.price);
    case "off": return f.off === null || item.off >= f.off;
    case "rating": return f.rating === null || (item.rating ?? 0) >= f.rating;
    case "offers": return !f.offers || item.offer;
    case "food": return !f.food || item.foodType === f.food;
    case "stock": return !f.stock || item.inStock;
  }
}

const GROUPS: Group[] = ["brand", "price", "off", "rating", "offers", "food", "stock"];
const passesAll = (item: Item, f: WebCategoryFilters, except?: Group) => GROUPS.every((g) => g === except || passes(item, g, f));

/** Band edges at the category's price quantiles, snapped to round numbers; the bands stay put as filters change */
function priceBands(all: Item[], pool: Item[]): WebCategoryFacets["priceBands"] {
  const prices = all.map((i) => i.price).sort((a, b) => a - b);
  if (prices.length < 2 || prices[0] === prices[prices.length - 1]) return [];
  const snap = (p: number) => BAND_EDGES.reduce((best, e) => (Math.abs(e - p) < Math.abs(best - p) ? e : best));
  const edges = [...new Set(BAND_QUANTILES.map((q) => snap(prices[Math.floor(q * (prices.length - 1))])))]
    .filter((e) => e > prices[0] && e < prices[prices.length - 1]);
  const bounds = [null, ...edges, null];
  return bounds.slice(0, -1).map((min, i) => {
    const max = bounds[i + 1];
    const count = pool.filter((p) => inRange(p.price, { min, max })).length;
    return { min, max, count };
  });
}

// Picked brands stay listed (at 0 when other filters leave them nothing) so they can be unticked
function brandFacet(all: Item[], pool: Item[], selected: string[]): WebCategoryFacets["brands"] {
  const brands = new Map<string, { slug: string; name: string; count: number }>();
  for (const { brand } of all) if (brand && selected.includes(brand.slug)) brands.set(brand.slug, { ...brand, count: 0 });
  for (const { brand } of pool) {
    if (!brand) continue;
    const entry = brands.get(brand.slug) ?? { ...brand, count: 0 };
    brands.set(brand.slug, { ...entry, count: entry.count + 1 });
  }
  return [...brands.values()]
    .sort((a, b) => Number(selected.includes(b.slug)) - Number(selected.includes(a.slug)) || b.count - a.count || a.name.localeCompare(b.name));
}

function facetsOf(all: Item[], f: WebCategoryFilters): WebCategoryFacets {
  const pool = (except: Group) => all.filter((i) => passesAll(i, f, except));
  const foods = pool("food");
  return {
    brands: brandFacet(all, pool("brand"), f.brand),
    priceBands: priceBands(all, pool("price")),
    discounts: DISCOUNT_TIERS.map((min) => ({ min, count: pool("off").filter((i) => i.off >= min).length })).filter((d) => d.count > 0 || d.min === f.off),
    ratings: RATING_TIERS.map((min) => ({ min, count: pool("rating").filter((i) => (i.rating ?? 0) >= min).length })).filter((r) => r.count > 0 || r.min === f.rating),
    offerCount: pool("offers").filter((i) => i.offer).length,
    foodTypes: Object.values(FoodType).map((type) => ({ type, count: foods.filter((i) => i.foodType === type).length })).filter((t) => t.count > 0 || t.type === f.food),
    inStockCount: pool("stock").filter((i) => i.inStock).length,
  };
}

const SORTS: Partial<Record<SearchSortBy, (a: Item, b: Item) => number>> = {
  [SearchSortBy.PRICE_ASC]: (a, b) => a.price - b.price,
  [SearchSortBy.PRICE_DESC]: (a, b) => b.price - a.price,
  [SearchSortBy.DISCOUNT]: (a, b) => b.off - a.off,
};

/** A category's (or brand's) products filtered, sorted (popular first unless asked) and paged, with Amazon-style facet counts */
export async function filteredList(prisma: PrismaClient, storeId: string, where: Prisma.ProductWhereInput, q: WebShopQuery, pageSize: number) {
  const all = await loadItems(prisma, storeId, where);
  const filters = filtersOf(q);
  const matched = all.filter((i) => passesAll(i, filters));
  const sort = SORTS[filters.sort];
  if (sort) matched.sort(sort);
  const skip = (q.page - 1) * pageSize;
  return {
    products: matched.slice(skip, skip + pageSize).map((i) => i.card),
    total: matched.length,
    totalPages: Math.ceil(matched.length / pageSize),
    filters,
    facets: facetsOf(all, filters),
  };
}
