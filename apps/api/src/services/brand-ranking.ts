import type { PrismaClient } from "../../generated/prisma/index.js";
import { NATIONAL_REGION } from "@martly/shared/constants";
import type { BrandRankingLevel } from "@martly/shared/schemas";
import type { BrandRankingRow, BrandRankingSource } from "@martly/shared/types";

type Scope = { level: BrandRankingLevel; id: string; region: string };
type Row = { brandId: string; region: string; popularity: number };

// The highest score a ranking gives; the order spreads down to 1
const TOP = 100;

/** The category a scope sits in (itself for a category); null when the id isn't one at that level */
async function categoryOf(prisma: PrismaClient, { level, id }: Scope) {
  if (level === "category") return (await prisma.category.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
  return (await prisma.subcategory.findUnique({ where: { id }, select: { categoryId: true } }))?.categoryId ?? null;
}

const find = (rows: Row[], brandId: string, region: string) => rows.find((r) => r.brandId === brandId && r.region === region)?.popularity;

/**
 * The brands with products in a category or subcategory, in their effective order there for one region, each with
 * where its score comes from. Null when the scope doesn't exist.
 */
export async function rankingFor(prisma: PrismaClient, scope: Scope): Promise<BrandRankingRow[] | null> {
  const categoryId = await categoryOf(prisma, scope);
  if (!categoryId) return null;
  const { level, id, region } = scope;
  const regional = region !== NATIONAL_REGION;
  const productWhere = level === "category" ? { subcategory: { categoryId: id } } : { subcategoryId: id };
  const [brands, subRows, catRows] = await Promise.all([
    prisma.brand.findMany({
      where: { products: { some: { isActive: true, ...productWhere } } },
      select: {
        id: true, name: true, imageUrl: true, popularity: true,
        regionalPopularity: { where: { region }, select: { popularity: true } },
        _count: { select: { products: { where: { isActive: true, ...productWhere } } } },
      },
    }),
    level === "subcategory" ? prisma.brandSubcategoryPopularity.findMany({ where: { subcategoryId: id } }) : Promise.resolve([] as Row[]),
    prisma.brandCategoryPopularity.findMany({ where: { categoryId } }),
  ]);
  const levelRows = level === "subcategory" ? subRows : catRows;
  const scored = brands.map((b) => {
    const candidates: [number | undefined, BrandRankingSource][] = [
      [find(levelRows, b.id, region), "here"],
      [regional ? find(levelRows, b.id, NATIONAL_REGION) : undefined, "allIndia"],
      [level === "subcategory" ? find(catRows, b.id, region) ?? find(catRows, b.id, NATIONAL_REGION) : undefined, "category"],
      [regional ? b.regionalPopularity[0]?.popularity : undefined, "region"],
      [b.popularity, "national"],
    ];
    const [popularity, source] = candidates.find(([score]) => score !== undefined) as [number, BrandRankingSource];
    return { id: b.id, name: b.name, imageUrl: b.imageUrl, products: b._count.products, popularity, source };
  });
  return scored.sort((a, b) => b.popularity - a.popularity || b.products - a.products || a.name.localeCompare(b.name));
}

/** Scores for an order, spread evenly from TOP down to 1 */
const scoresFor = (count: number) => Array.from({ length: count }, (_, i) => (count === 1 ? TOP : Math.round(TOP - (i * (TOP - 1)) / (count - 1))));

/** Replaces a scope's ranking for one region with this order; false when the scope doesn't exist */
export async function saveRanking(prisma: PrismaClient, scope: Scope, brandIds: string[]) {
  if (!(await categoryOf(prisma, scope))) return false;
  const known = await prisma.brand.count({ where: { id: { in: brandIds } } });
  if (known !== brandIds.length) throw Object.assign(new Error("Unknown brand in the ranking"), { statusCode: 400 });
  const scores = scoresFor(brandIds.length);
  const { level, id, region } = scope;
  if (level === "category") {
    await prisma.$transaction([
      prisma.brandCategoryPopularity.deleteMany({ where: { categoryId: id, region } }),
      prisma.brandCategoryPopularity.createMany({ data: brandIds.map((brandId, i) => ({ brandId, categoryId: id, region, popularity: scores[i] })) }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.brandSubcategoryPopularity.deleteMany({ where: { subcategoryId: id, region } }),
      prisma.brandSubcategoryPopularity.createMany({ data: brandIds.map((brandId, i) => ({ brandId, subcategoryId: id, region, popularity: scores[i] })) }),
    ]);
  }
  return true;
}

/** Drops a scope's ranking for one region, so its brands fall back to the next score in line */
export async function resetRanking(prisma: PrismaClient, { level, id, region }: Scope) {
  if (level === "category") await prisma.brandCategoryPopularity.deleteMany({ where: { categoryId: id, region } });
  else await prisma.brandSubcategoryPopularity.deleteMany({ where: { subcategoryId: id, region } });
}
