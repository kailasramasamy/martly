import type { Prisma, PrismaClient } from "../../generated/prisma/index.js";
import { STORE_BRAND_DEPARTMENT_SLUG, type BrandPick } from "@martly/shared/constants";
import { aimedAtStore } from "./brand-campaigns/targeting.js";
import { subcategoryIdsUnder } from "./category-browse.js";

/**
 * What a store promotes: unless the owner switches it off, its own brands plus its unbranded staples (store-packed rice,
 * dal, flour…), both labelled "Our brand"; and brands paying Martly to be featured, each in the category it bought
 */
export interface BrandBoost {
  ownBrandIds: string[];
  /** Subcategories whose unbranded products are the store's own packs; empty when own-brand boosting is off */
  stapleSubcategoryIds: string[];
  featured: { brandId: string; subcategoryIds: string[] }[];
}

export const NO_BOOST: BrandBoost = { ownBrandIds: [], stapleSubcategoryIds: [], featured: [] };

export const hasBoost = (boost: BrandBoost) => boost.ownBrandIds.length > 0 || boost.stapleSubcategoryIds.length > 0 || boost.featured.length > 0;

/** Featured (brand, subcategory) pairs as two parallel arrays, for SQL that unnests them */
export function featuredPairs(boost: BrandBoost) {
  const pairs = boost.featured.flatMap((f) => f.subcategoryIds.map((sub) => [f.brandId, sub] as const));
  return { brandIds: pairs.map(([b]) => b), subcategoryIds: pairs.map(([, sub]) => sub) };
}

/** Brands paying Martly to be featured in this store right now: live featured-brand campaigns aimed at it */
function featuredHere(store: { id: string; state: string | null; district: string | null }, now = new Date()): Prisma.BrandCampaignWhereInput {
  return { status: "LIVE", endsAt: { gt: now }, product: { kind: "BRAND_FEATURE" }, ...aimedAtStore(store) };
}

/** Aisles whose unbranded products are a store's own loose or packed staples */
export async function stapleSubcategoryIds(prisma: PrismaClient) {
  const staples = await prisma.subcategory.findMany({ where: { category: { department: { slug: STORE_BRAND_DEPARTMENT_SLUG } } }, select: { id: true } });
  return staples.map((s) => s.id);
}

export async function storeBrandBoost(prisma: PrismaClient, storeId: string): Promise<BrandBoost> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, state: true, district: true, organization: { select: { boostOwnBrands: true, brands: { select: { id: true } } } } },
  });
  if (!store) return NO_BOOST;
  const campaigns = await prisma.brandCampaign.findMany({ where: featuredHere(store), select: { brandId: true, categoryId: true } });
  const featured = await Promise.all(campaigns.filter((c) => c.categoryId).map(async (c) => (
    { brandId: c.brandId, subcategoryIds: await subcategoryIdsUnder(prisma, c.categoryId!) }
  )));
  if (!store.organization.boostOwnBrands) return { ownBrandIds: [], stapleSubcategoryIds: [], featured };
  return { ownBrandIds: store.organization.brands.map((b) => b.id), stapleSubcategoryIds: await stapleSubcategoryIds(prisma), featured };
}

type BoostedRow = { product: { brandId: string | null; subcategoryId: string | null } };

/** Why a product is boosted, if it is; the store's own brand wins over a feature */
export function brandPickOf({ product }: BoostedRow, boost: BrandBoost): BrandPick | undefined {
  const { brandId, subcategoryId } = product;
  if (!brandId) return subcategoryId && boost.stapleSubcategoryIds.includes(subcategoryId) ? "OWN" : undefined;
  if (boost.ownBrandIds.includes(brandId)) return "OWN";
  const featured = boost.featured.some((f) => f.brandId === brandId && !!subcategoryId && f.subcategoryIds.includes(subcategoryId));
  return featured ? "FEATURED" : undefined;
}

/** Labels boosted products on the card, so a promoted brand is never passed off as plain relevance */
export function markBrandPicks<T extends BoostedRow>(rows: T[], boost: BrandBoost) {
  return rows.map((row) => {
    const pick = brandPickOf(row, boost);
    return pick ? { ...row, brandPick: pick } : row;
  });
}

// Boosted rows take every third slot of a listing, starting with the first, until they run out
const BOOST_EVERY = 3;

/** Boosted rows among a listing's first n: their share of slots, or more once the other rows run out */
function boostedBefore(n: number, boostedTotal: number, restTotal: number) {
  return Math.min(boostedTotal, Math.max(Math.ceil(n / BOOST_EVERY), n - restTotal));
}

type ProductWhere = Prisma.ProductWhereInput;

/**
 * Store products a boost lifts, and the rest. Each "not" is spelled out with its nulls, because SQL drops a row whose
 * brand or subcategory is null from a plain NOT IN.
 */
function boostSplit(boost: BrandBoost): { boosted: Prisma.StoreProductWhereInput; rest: Prisma.StoreProductWhereInput } {
  const { ownBrandIds: own, stapleSubcategoryIds: staples, featured } = boost;
  const lifted: ProductWhere[] = [
    ...(own.length ? [{ brandId: { in: own } }] : []),
    ...(staples.length ? [{ brandId: null, subcategoryId: { in: staples } }] : []),
    ...featured.map((f) => ({ brandId: f.brandId, subcategoryId: { in: f.subcategoryIds } })),
  ];
  const notLifted: ProductWhere[] = [
    ...(own.length ? [{ OR: [{ brandId: null }, { brandId: { notIn: own } }] }] : []),
    ...(staples.length ? [{ OR: [{ brandId: { not: null } }, { subcategoryId: null }, { subcategoryId: { notIn: staples } }] }] : []),
    ...featured.map((f) => ({ OR: [{ brandId: null }, { brandId: { not: f.brandId } }, { subcategoryId: null }, { subcategoryId: { notIn: f.subcategoryIds } }] })),
  ];
  return { boosted: { product: { OR: lifted } }, rest: { product: { AND: notLifted } } };
}

/**
 * One page of a listing with the boosted brands' rows taking turns with the rest (each part in the listing's own
 * order), so a brand with a hundred products leads the aisle without filling it. Slot math keeps paging in the
 * database instead of loading the whole listing to sort it.
 */
export async function boostedListingPage<T>(
  boost: BrandBoost,
  where: Prisma.StoreProductWhereInput,
  page: { skip: number; take: number },
  find: (where: Prisma.StoreProductWhereInput, skip: number, take: number) => Promise<T[]>,
  count: (where: Prisma.StoreProductWhereInput) => Promise<number>,
): Promise<{ rows: T[]; total: number }> {
  const { boosted, rest } = boostSplit(boost);
  const [boostedWhere, restWhere] = [{ AND: [where, boosted] }, { AND: [where, rest] }];
  const [boostedTotal, restTotal] = await Promise.all([count(boostedWhere), count(restWhere)]);
  const total = boostedTotal + restTotal;
  const end = Math.min(page.skip + page.take, total);
  if (page.skip >= end) return { rows: [], total };
  const before = (n: number) => boostedBefore(n, boostedTotal, restTotal);
  const [b0, b1] = [before(page.skip), before(end)];
  const [head, tail] = await Promise.all([
    b1 > b0 ? find(boostedWhere, b0, b1 - b0) : [],
    end - page.skip > b1 - b0 ? find(restWhere, page.skip - b0, end - page.skip - (b1 - b0)) : [],
  ]);
  const rows: T[] = [];
  for (let i = page.skip; i < end; i++) {
    const next = before(i + 1) > before(i) ? head.shift() : tail.shift();
    if (next) rows.push(next);
  }
  return { rows, total };
}

type Page = { skip: number; take: number };

/**
 * A staples aisle leads with the store's loose items (its own rice, dal, flour…), then the rest of the listing in its
 * usual order; paging runs across both in the database
 */
export async function looseFirstPage<T>(
  looseSubcategoryIds: string[],
  where: Prisma.StoreProductWhereInput,
  page: Page,
  find: (where: Prisma.StoreProductWhereInput, skip: number, take: number) => Promise<T[]>,
  count: (where: Prisma.StoreProductWhereInput) => Promise<number>,
  rest: (where: Prisma.StoreProductWhereInput, page: Page) => Promise<{ rows: T[]; total: number }>,
): Promise<{ rows: T[]; total: number }> {
  const loose: Prisma.StoreProductWhereInput = { AND: [where, { product: { brandId: null, subcategoryId: { in: looseSubcategoryIds } } }] };
  const others: Prisma.StoreProductWhereInput = {
    AND: [where, { product: { OR: [{ brandId: { not: null } }, { subcategoryId: null }, { subcategoryId: { notIn: looseSubcategoryIds } }] } }],
  };
  const looseTotal = await count(loose);
  const head = page.skip < looseTotal ? await find(loose, page.skip, Math.min(page.take, looseTotal - page.skip)) : [];
  const after = await rest(others, { skip: Math.max(0, page.skip - looseTotal), take: page.take - head.length });
  return { rows: [...head, ...after.rows], total: looseTotal + after.total };
}

