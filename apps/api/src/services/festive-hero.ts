import type { PrismaClient } from "../../generated/prisma/client.js";
import { FESTIVAL_DAYS_SELECT, rankFestivals } from "./festival-rank.js";
import { liveWindow, reviewSummaries, withAllSizes, withReviews } from "./store-feed.js";

// The hero shows the nearest festival only, holding still so the banner carousel below is the one thing that moves;
// other live festivals fall through to rows further down Home
const MAX_HEROES = 1;

type HeroCollection = {
  id: string; heroTitle: string | null; heroKicker: string | null; heroSubtitle: string | null;
  heroImageUrl: string | null; heroTheme: unknown; translations: unknown;
  tiles: { id: string; title: string; translations: unknown; imageUrl: string; subcategoryIds: string[] }[];
};

function liveHeroWhere(organizationId: string, now = new Date()) {
  return {
    isActive: true,
    kind: { in: ["OCCASION" as const, "SEASON" as const] },
    heroImageUrl: { not: null },
    OR: [{ organizationId }, { organizationId: null }],
    AND: liveWindow(now),
  };
}

// The aisles this store has something in stock for, keyed by id, with what the screen's pills show
async function stockedSubcategories(prisma: PrismaClient, storeId: string, subcategoryIds: string[]) {
  return new Map((await prisma.subcategory.findMany({
    where: {
      id: { in: subcategoryIds },
      products: { some: { isActive: true, storeProducts: { some: { storeId, isActive: true, stock: { gt: 0 } } } } },
    },
    select: { id: true, name: true, imageUrl: true, translations: true },
  })).map((s) => [s.id, s]));
}

// Tiles whose aisles are empty at this store are hidden
async function forStore(prisma: PrismaClient, storeId: string, collection: HeroCollection) {
  const stocked = await stockedSubcategories(prisma, storeId, collection.tiles.flatMap((t) => t.subcategoryIds));
  const tiles = collection.tiles
    .map((t) => ({ ...t, subcategories: t.subcategoryIds.flatMap((id) => stocked.get(id) ?? []) }))
    .filter((t) => t.subcategories.length > 0);
  if (tiles.length === 0) return null;
  const ta = (collection.translations as { ta?: { heroTitle?: string; heroKicker?: string; heroSubtitle?: string } } | null)?.ta;
  return {
    id: collection.id,
    title: collection.heroTitle ?? "",
    kicker: collection.heroKicker,
    subtitle: collection.heroSubtitle,
    translations: ta?.heroTitle ? { ta: { title: ta.heroTitle, kicker: ta.heroKicker, subtitle: ta.heroSubtitle } } : null,
    imageUrl: collection.heroImageUrl as string,
    theme: collection.heroTheme as { background: string; title: string; dark: boolean },
    tiles: tiles.map(({ id, title, translations, imageUrl, subcategories }) => ({ id, title, translations, imageUrl, subcategories })),
  };
}

const HERO_SELECT = {
  id: true, kind: true, startsAt: true, endsAt: true, ...FESTIVAL_DAYS_SELECT, heroTitle: true, heroKicker: true, heroSubtitle: true, heroImageUrl: true, heroTheme: true, translations: true,
  tiles: { orderBy: { sortOrder: "asc" as const }, select: { id: true, title: true, translations: true, imageUrl: true, subcategoryIds: true } },
};

/** The home screen's festive hero: the first live festival this store can stock, in rankFestivals order. */
export async function liveFestiveHeroes(
  prisma: PrismaClient, store: { id: string; organizationId: string }, now = new Date(),
) {
  const collections = await prisma.collection.findMany({ where: liveHeroWhere(store.organizationId, now), select: HERO_SELECT });
  const heroes = await Promise.all(rankFestivals(collections, now).map((c) => forStore(prisma, store.id, c)));
  return heroes.filter((h) => h !== null).slice(0, MAX_HEROES);
}

/** Live festivals for an organisation, best first in rankFestivals order; the hero shows the first one the store stocks */
export async function rankedFestivals(prisma: PrismaClient, organizationId: string, now = new Date()) {
  const collections = await prisma.collection.findMany({
    where: liveHeroWhere(organizationId, now),
    select: { id: true, kind: true, startsAt: true, endsAt: true, ...FESTIVAL_DAYS_SELECT, heroTitle: true, heroSubtitle: true, title: true, subtitle: true, translations: true },
  });
  return rankFestivals(collections, now);
}

export async function festiveHeroById(prisma: PrismaClient, store: { id: string; organizationId: string }, collectionId: string) {
  const collection = await prisma.collection.findFirst({ where: { id: collectionId, ...liveHeroWhere(store.organizationId) }, select: HERO_SELECT });
  return collection ? forStore(prisma, store.id, collection) : null;
}

/** One tile's shelf: in-stock products with each aisle's best sellers at this store interleaved, so the first screen mixes aisles. */
export async function tileProducts(prisma: PrismaClient, storeId: string, subcategoryIds: string[], page: number, pageSize: number) {
  const ranked = await prisma.$queryRaw<{ id: string; total: number }[]>`
    SELECT id, COUNT(*) OVER()::int AS total FROM (
      SELECT p.id, p.subcategory_id,
        ROW_NUMBER() OVER (PARTITION BY p.subcategory_id ORDER BY COALESCE(sales.qty, 0) DESC, SUM(sp.stock) DESC, p.id) AS rank
      FROM products p
      JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${storeId}
      LEFT JOIN (
        SELECT oi.product_id, SUM(oi.quantity) AS qty
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
        GROUP BY oi.product_id
      ) sales ON sales.product_id = p.id
      WHERE p.is_active AND sp.is_active AND sp.stock > 0 AND p.subcategory_id = ANY(${subcategoryIds})
      GROUP BY p.id, p.subcategory_id, sales.qty
    ) ranked
    ORDER BY rank, array_position(${subcategoryIds}::text[], subcategory_id), id
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  const products = await withAllSizes(prisma, storeId, ranked.map((r) => ({ productId: r.id })));
  const reviews = await reviewSummaries(prisma, ranked.map((r) => r.id));
  return { products: withReviews(products, reviews), total: ranked[0]?.total ?? 0 };
}
