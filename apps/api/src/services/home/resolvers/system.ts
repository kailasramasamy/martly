import { getTimePeriod, TIME_CATEGORY_MAP } from "../../time-picks.js";
import { buildProductData, enrichStoreProduct, withAllSizes } from "../../store-feed.js";
import { liveFestiveHeroes } from "../../festive-hero.js";
import { storeBanners } from "../../marketing/banner-feed.js";
import { buyAgainProducts, activeDealRows, pastOrderLines } from "../feed-queries.js";
import { sectionBase, type ResolveContext, type ResolvedSection, type SectionResolver } from "../types.js";
import { recipeSummaries } from "./recipes.js";
import { couponOffers, HOME_OFFER_LIMIT } from "../../coupon-offers.js";

function system(entry: Parameters<SectionResolver>[1], data: Record<string, unknown>): ResolvedSection {
  return { ...sectionBase(entry), type: entry.type, data } as ResolvedSection;
}

// Blocks whose content the app loads itself, shown whenever the layout places them
export const clientFetched: SectionResolver = async (_ctx, entry) => system(entry, {});

// Looked up once per request: the layout expansion needs the heroes' collections too, to keep them out of other rows
const heroesByRequest = new WeakMap<ResolveContext, ReturnType<typeof liveFestiveHeroes>>();
export function festiveHeroesFor(ctx: ResolveContext) {
  let heroes = heroesByRequest.get(ctx);
  if (!heroes) heroesByRequest.set(ctx, heroes = liveFestiveHeroes(ctx.prisma, ctx.store, ctx.now));
  return heroes;
}

// `hero` is the lead slide, for released app builds that show a single hero
export const festiveHero: SectionResolver = async (ctx, entry) => {
  const heroes = await festiveHeroesFor(ctx);
  return heroes.length > 0 ? system(entry, { hero: heroes[0], heroes }) : null;
};

const bannersFor = (placement: "HOME_POSTER"): SectionResolver => async (ctx, entry) => {
  const banners = await storeBanners(ctx.prisma, ctx.store, [placement]);
  return banners.length > 0 ? system(entry, { banners }) : null;
};
// Paid brand slides lead the carousel, ahead of the store's own banners
export const heroBanners: SectionResolver = async (ctx, entry) => {
  const banners = await storeBanners(ctx.prisma, ctx.store, ["HERO_CAROUSEL"]);
  const ordered = [...banners.filter((b) => b.sponsorType === "BRAND"), ...banners.filter((b) => b.sponsorType !== "BRAND")];
  return ordered.length > 0 ? system(entry, { banners: ordered }) : null;
};
// Brand posters run through the same feed, so the org's brand-ads switch, blocked brands and slot limits apply
export const brandPosters = bannersFor("HOME_POSTER");

// Advertised coupons the shopper can still use; tapping one saves it for checkout
export const offers: SectionResolver = async (ctx, entry) => {
  const list = await couponOffers(ctx.prisma, { organizationId: ctx.store.organizationId, userId: ctx.userId, limit: HOME_OFFER_LIMIT });
  return list.length > 0 ? system(entry, { offers: list }) : null;
};

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
