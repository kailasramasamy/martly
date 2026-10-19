import { getTimePeriod, TIME_CATEGORY_MAP } from "../../time-picks.js";
import { buildProductData, enrichStoreProduct, withAllSizes } from "../../store-feed.js";
import { liveFestiveHero } from "../../festive-hero.js";
import { storeBanners } from "../../marketing/banner-feed.js";
import { buyAgainProducts, activeDealRows, pastOrderLines } from "../feed-queries.js";
import { sectionBase, type ResolvedSection, type SectionResolver } from "../types.js";
import { recipeSummaries } from "./recipes.js";

function system(entry: Parameters<SectionResolver>[1], data: Record<string, unknown>): ResolvedSection {
  return { ...sectionBase(entry), type: entry.type, data } as ResolvedSection;
}

// Blocks whose content the app loads itself, shown whenever the layout places them
export const clientFetched: SectionResolver = async (_ctx, entry) => system(entry, {});

export const festiveHero: SectionResolver = async (ctx, entry) => {
  const hero = await liveFestiveHero(ctx.prisma, ctx.store);
  return hero ? system(entry, { hero }) : null;
};

const bannersFor = (placement: "HERO_CAROUSEL" | "MID_PAGE"): SectionResolver => async (ctx, entry) => {
  const banners = await storeBanners(ctx.prisma, ctx.store, [placement]);
  return banners.length > 0 ? system(entry, { banners }) : null;
};
export const heroBanners = bannersFor("HERO_CAROUSEL");
export const midBanners = bannersFor("MID_PAGE");

export const buyAgain: SectionResolver = async (ctx, entry) => {
  if (!ctx.userId) return null;
  const lines = await pastOrderLines(ctx.prisma, ctx.store.id, ctx.userId);
  const products = await buyAgainProducts(ctx.prisma, ctx.store.id, lines);
  return products.length > 0 ? system(entry, { products }) : null;
};

export const deals: SectionResolver = async (ctx, entry) => {
  const rows = await activeDealRows(ctx.prisma, ctx.store.id, ctx.now);
  const products = await withAllSizes(ctx.prisma, ctx.store.id, rows);
  return products.length > 0 ? system(entry, { products }) : null;
};

export const timePicks: SectionResolver = async (ctx, entry) => {
  const period = getTimePeriod();
  const storeId = ctx.store.id;
  const subcategories = await ctx.prisma.subcategory.findMany({
    where: { name: { in: TIME_CATEGORY_MAP[period], mode: "insensitive" } },
    include: {
      products: {
        where: { isActive: true, storeProducts: { some: { storeId, isActive: true } } },
        take: 10,
        include: { storeProducts: { where: { storeId, isActive: true }, include: { variant: true } }, brand: true, subcategory: true, variants: true },
      },
    },
  });
  const categories = subcategories
    .filter((cat) => cat.products.length > 0)
    .map((cat) => ({
      id: cat.id, name: cat.name, slug: cat.slug, translations: cat.translations,
      products: cat.products.flatMap((p) => p.storeProducts.map((sp) => enrichStoreProduct({ ...sp, product: buildProductData(p) }))),
    }));
  return categories.length > 0 ? system(entry, { period, categories }) : null;
};

export const departmentGrid: SectionResolver = async (ctx, entry) => {
  const departments = await ctx.prisma.department.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, sortOrder: true, imageUrl: true, translations: true },
  });
  return departments.length > 0 ? system(entry, { departments }) : null;
};

export const recipes: SectionResolver = async (ctx, entry) => {
  const list = await recipeSummaries(ctx.prisma, ctx.store);
  return list.length > 0 ? system(entry, { recipes: list }) : null;
};
