import type { Prisma, PrismaClient } from "../../generated/prisma/index.js";
import { STORE_BRAND_DEPARTMENT_SLUG, type BrandPick } from "@martly/shared/constants";

/**
 * What an organisation promotes in its stores: featured brands (set by Martly), and unless switched off its own brands
 * plus its unbranded staples (store-packed rice, dal, flour…), both labelled "Our brand"
 */
export interface BrandBoost {
  brands: Map<string, BrandPick>;
  /** Subcategories whose unbranded products are the store's own packs; empty when own-brand boosting is off */
  stapleSubcategoryIds: string[];
}

export const NO_BOOST: BrandBoost = { brands: new Map(), stapleSubcategoryIds: [] };

export const hasBoost = (boost: BrandBoost) => boost.brands.size > 0 || boost.stapleSubcategoryIds.length > 0;

export async function storeBrandBoost(prisma: PrismaClient, storeId: string): Promise<BrandBoost> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      organization: {
        select: {
          boostOwnBrands: true,
          brands: { select: { id: true } },
          brandFeatures: { select: { brandId: true } },
        },
      },
    },
  });
  const org = store?.organization;
  if (!org) return NO_BOOST;
  const brands = new Map<string, BrandPick>(org.brandFeatures.map((f) => [f.brandId, "FEATURED"]));
  if (!org.boostOwnBrands) return { brands, stapleSubcategoryIds: [] };
  for (const { id } of org.brands) brands.set(id, "OWN");
  const staples = await prisma.subcategory.findMany({
    where: { category: { department: { slug: STORE_BRAND_DEPARTMENT_SLUG } } }, select: { id: true },
  });
  return { brands, stapleSubcategoryIds: staples.map((s) => s.id) };
}

type BoostedRow = { product: { brandId: string | null; subcategoryId: string | null } };

/** Why a product is boosted, if it is */
export function brandPickOf({ product }: BoostedRow, boost: BrandBoost): BrandPick | undefined {
  if (product.brandId) return boost.brands.get(product.brandId);
  return product.subcategoryId && boost.stapleSubcategoryIds.includes(product.subcategoryId) ? "OWN" : undefined;
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
  const brandIds = [...boost.brands.keys()];
  const staples = boost.stapleSubcategoryIds;
  const boosted: Prisma.StoreProductWhereInput = {
    AND: [where, { OR: [{ product: { brandId: { in: brandIds } } }, { product: { brandId: null, subcategoryId: { in: staples } } }] }],
  };
  const rest: Prisma.StoreProductWhereInput = {
    AND: [where, {
      OR: [
        { product: { brandId: { not: null, notIn: brandIds } } },
        { product: { brandId: null, OR: [{ subcategoryId: null }, { subcategoryId: { notIn: staples } }] } },
      ],
    }],
  };
  const [boostedTotal, restTotal] = await Promise.all([count(boosted), count(rest)]);
  const total = boostedTotal + restTotal;
  const end = Math.min(page.skip + page.take, total);
  if (page.skip >= end) return { rows: [], total };
  const before = (n: number) => boostedBefore(n, boostedTotal, restTotal);
  const [b0, b1] = [before(page.skip), before(end)];
  const [head, tail] = await Promise.all([
    b1 > b0 ? find(boosted, b0, b1 - b0) : [],
    end - page.skip > b1 - b0 ? find(rest, page.skip - b0, end - page.skip - (b1 - b0)) : [],
  ]);
  const rows: T[] = [];
  for (let i = page.skip; i < end; i++) {
    const next = before(i + 1) > before(i) ? head.shift() : tail.shift();
    if (next) rows.push(next);
  }
  return { rows, total };
}
