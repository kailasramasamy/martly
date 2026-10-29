import type { PrismaClient } from "../../../generated/prisma/client.js";
import { getTimePeriod, TIME_CATEGORY_MAP, type TimePeriod } from "../time-picks.js";
import { buildProductData, enrichStoreProduct, liveWindow, reviewSummaries, withAllSizes, withReviews } from "../store-feed.js";
import { activeDealRows } from "./feed-queries.js";
import { liveFestiveHeroes } from "../festive-hero.js";
import { storeBanners } from "../marketing/banner-feed.js";
import { ttlCache } from "../ttl-cache.js";
import type { StoreRef } from "./types.js";

// App builds before the sections Home (1.0.5 and older) draw each collection as one rail; it carries this many products
const LEGACY_RAIL_ITEMS = 20;
// The feed is the same for every shopper of a store at a time of day, so it's rebuilt at most this often
const FEED_TTL_MS = 60_000;

const PRODUCT_INCLUDE = (storeId: string) => ({
  storeProducts: { where: { storeId, isActive: true }, include: { variant: true } },
  brand: true,
  subcategory: true,
  variants: true,
});

// Live collections with the store's listings of their first products, for home rails (a promo opens from its banner)
function collectionRows(prisma: PrismaClient, store: StoreRef, now: Date) {
  return prisma.collection.findMany({
    where: {
      isActive: true, kind: { not: "PROMO" },
      OR: [{ organizationId: store.organizationId }, { organizationId: null }],
      AND: liveWindow(now),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { product: { storeProducts: { some: { storeId: store.id, isActive: true } } } },
        orderBy: { sortOrder: "asc" },
        take: LEGACY_RAIL_ITEMS,
        include: { product: { include: PRODUCT_INCLUDE(store.id) } },
      },
    },
  });
}

// Time-aware subcategories (by name) with up to ten of their listed products
function timeCategoryRows(prisma: PrismaClient, storeId: string, timePeriod: TimePeriod) {
  return prisma.subcategory.findMany({
    where: { name: { in: TIME_CATEGORY_MAP[timePeriod], mode: "insensitive" } },
    include: {
      products: {
        where: { isActive: true, storeProducts: { some: { storeId, isActive: true } } },
        take: 10,
        include: PRODUCT_INCLUDE(storeId),
      },
    },
  });
}

// Active recipes with each ingredient's cheapest listing, for the availability summary
function recipeRows(prisma: PrismaClient, store: StoreRef) {
  return prisma.recipe.findMany({
    where: { isActive: true, OR: [{ organizationId: store.organizationId }, { organizationId: null }] },
    orderBy: { sortOrder: "asc" },
    take: 6,
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: { include: { storeProducts: { where: { storeId: store.id, isActive: true }, orderBy: { price: "asc" }, take: 1 } } } },
      },
    },
  });
}

type RecipeRow = Awaited<ReturnType<typeof recipeRows>>[number];

function recipeSummary(recipe: RecipeRow) {
  const listed = recipe.items.map((item) => item.product.storeProducts[0]).filter((sp) => sp !== undefined);
  const estimatedTotal = listed.reduce((sum, sp) => sum + Number(sp.price), 0);
  return {
    id: recipe.id, title: recipe.title, slug: recipe.slug, imageUrl: recipe.imageUrl, difficulty: recipe.difficulty,
    cuisineType: recipe.cuisineType, dietType: recipe.dietType, prepTime: recipe.prepTime, cookTime: recipe.cookTime,
    servings: recipe.servings, translations: recipe.translations, ingredientCount: recipe.items.length,
    availableCount: listed.length, estimatedTotal: Math.round(estimatedTotal * 100) / 100,
  };
}

const listings = (product: { storeProducts: object[] }) => product.storeProducts.map((sp) => enrichStoreProduct({ ...sp, product: buildProductData(product) }));

async function buildFeed(prisma: PrismaClient, store: StoreRef, timePeriod: TimePeriod) {
  const now = new Date();
  const [collections, departments, timeCategories, dealRows, banners, recipes, festiveHero] = await Promise.all([
    collectionRows(prisma, store, now),
    prisma.department.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, sortOrder: true, imageUrl: true, translations: true },
    }),
    timeCategoryRows(prisma, store.id, timePeriod),
    activeDealRows(prisma, store.id, now),
    storeBanners(prisma, store, ["HERO_CAROUSEL"]),
    recipeRows(prisma, store),
    liveFestiveHeroes(prisma, store).then((heroes) => heroes[0] ?? null),
  ]);
  const rails = collections
    .map((col) => ({
      id: col.id, title: col.title, subtitle: col.subtitle, slug: col.slug, imageUrl: col.imageUrl, kind: col.kind,
      translations: col.translations, products: col.items.flatMap((item) => listings(item.product)),
    }))
    .filter((col) => col.products.length > 0);
  const picks = timeCategories.filter((cat) => cat.products.length > 0).map((cat) => ({
    id: cat.id, name: cat.name, slug: cat.slug, translations: cat.translations, products: cat.products.flatMap(listings),
  }));
  const deals = await withAllSizes(prisma, store.id, dealRows);
  const reviews = await reviewSummaries(prisma, [...rails, ...picks].flatMap((c) => c.products.map((p) => p.productId as string))
    .concat(deals.map((d: any) => d.productId as string)));
  return {
    collections: rails.map((c) => ({ ...c, products: withReviews(c.products, reviews) })),
    departments,
    timeCategories: picks.map((c) => ({ ...c, products: withReviews(c.products, reviews) })),
    timePeriod,
    deals: withReviews(deals, reviews),
    banners,
    recipes: recipes.map(recipeSummary),
    festiveHero,
  };
}

const feedCache = ttlCache<Awaited<ReturnType<typeof buildFeed>>>(FEED_TTL_MS);

/** The legacy Home feed's shopper-independent part for a store: rails, departments, time picks, deals, banners, recipes */
export function legacyHomeFeed(prisma: PrismaClient, store: StoreRef) {
  const timePeriod = getTimePeriod();
  return feedCache.get(`${store.id}:${timePeriod}`, () => buildFeed(prisma, store, timePeriod));
}
