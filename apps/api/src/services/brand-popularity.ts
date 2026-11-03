import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import { NATIONAL_REGION } from "@martly/shared/constants";
import { regionOf } from "./onboarding/create.js";

/** The region whose brand scores apply at a store, from its state; null where no region code covers the state */
export async function storeRegion(prisma: PrismaClient, storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { state: true } });
  return regionOf(store?.state ?? null);
}

// A ranking for the store's region beats the All India one at the same level
export const rankingRegions = (region: string | null) => (region ? [region, NATIONAL_REGION] : [NATIONAL_REGION]);

/**
 * A brand's popularity (brands joined as `alias`): given the product's subcategory, Martly's ranking in that subcategory,
 * then in its category (each for the region, then All India); then the brand's regional score, then its national one
 */
export function brandPopularitySql(region: string | null, alias = "b", subcategory?: Prisma.Sql) {
  const b = Prisma.raw(alias);
  const regions = rankingRegions(region);
  const ranked = subcategory ? [
    Prisma.sql`(SELECT r.popularity FROM brand_subcategory_popularity r
      WHERE r.brand_id = ${b}.id AND r.subcategory_id = ${subcategory} AND r.region = ANY(${regions}::text[])
      ORDER BY r.region = ${NATIONAL_REGION} LIMIT 1)`,
    Prisma.sql`(SELECT r.popularity FROM brand_category_popularity r JOIN subcategories rs ON rs.category_id = r.category_id
      WHERE r.brand_id = ${b}.id AND rs.id = ${subcategory} AND r.region = ANY(${regions}::text[])
      ORDER BY r.region = ${NATIONAL_REGION} LIMIT 1)`,
  ] : [];
  const regional = region
    ? [Prisma.sql`(SELECT rp.popularity FROM brand_region_popularity rp WHERE rp.brand_id = ${b}.id AND rp.region = ${region})`]
    : [];
  return Prisma.sql`COALESCE(${Prisma.join([...ranked, ...regional, Prisma.sql`${b}.popularity`, Prisma.sql`0`])})`;
}

/** A product's brand popularity where it sits; an unbranded product scores 0 */
export type PopularityOf = (product: { brandId: string | null; subcategoryId: string | null }) => number;

type Score = { brandId: string; region: string; popularity: number };

// The region's row over the All India one
const pick = (rows: Score[], region: string | null) => (rows.find((r) => r.region === region) ?? rows.find((r) => r.region === NATIONAL_REGION))?.popularity;

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(key(row));
    if (list) list.push(row);
    else map.set(key(row), [row]);
  }
  return map;
}

/** The same resolution as brandPopularitySql, loaded once for a listing sorted in code */
export async function brandPopularityLookup(
  prisma: PrismaClient, region: string | null, products: { brandId: string | null; subcategoryId: string | null }[],
): Promise<PopularityOf> {
  const brandIds = [...new Set(products.flatMap((p) => (p.brandId ? [p.brandId] : [])))];
  const subcategoryIds = [...new Set(products.flatMap((p) => (p.subcategoryId ? [p.subcategoryId] : [])))];
  const regions = rankingRegions(region);
  const [brands, subcategories, subRows] = await Promise.all([
    prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, popularity: true, regionalPopularity: { where: { region: region ?? "" }, select: { popularity: true } } },
    }),
    prisma.subcategory.findMany({ where: { id: { in: subcategoryIds } }, select: { id: true, categoryId: true } }),
    prisma.brandSubcategoryPopularity.findMany({ where: { brandId: { in: brandIds }, subcategoryId: { in: subcategoryIds }, region: { in: regions } } }),
  ]);
  const categoryOf = new Map(subcategories.map((s) => [s.id, s.categoryId]));
  const catRows = await prisma.brandCategoryPopularity.findMany({
    where: { brandId: { in: brandIds }, categoryId: { in: [...new Set(categoryOf.values())] }, region: { in: regions } },
  });
  const bySub = groupBy(subRows, (r) => `${r.brandId}|${r.subcategoryId}`);
  const byCat = groupBy(catRows, (r) => `${r.brandId}|${r.categoryId}`);
  const own = new Map(brands.map((b) => [b.id, b.regionalPopularity[0]?.popularity ?? b.popularity]));
  return ({ brandId, subcategoryId }) => {
    if (!brandId) return 0;
    const sub = subcategoryId ? pick(bySub.get(`${brandId}|${subcategoryId}`) ?? [], region) : undefined;
    const cat = subcategoryId ? pick(byCat.get(`${brandId}|${categoryOf.get(subcategoryId)}`) ?? [], region) : undefined;
    return sub ?? cat ?? own.get(brandId) ?? 0;
  };
}
