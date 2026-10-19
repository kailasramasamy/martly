import type { HeroTileLayout } from "@martly/shared/constants";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { FESTIVAL_DAYS_SELECT, rankFestivals } from "./festival-rank.js";
import { liveWindow, reviewSummaries, withAllSizes, withReviews } from "./store-feed.js";

const GRID_COLUMNS = 3;
// One tall tile and a 2×2 block
const FEATURE_TILES = 5;
// Festivals live at once share the hero as a carousel, at most this many
const MAX_HEROES = 3;

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

// A feature layout is used only when the store stocks exactly its five tiles, so it never hides one; else rows of three
function layTiles<T>(tiles: T[], wanted: HeroTileLayout) {
  if (wanted === "FEATURE" && tiles.length === FEATURE_TILES) return { tileLayout: wanted, shown: tiles };
  return { tileLayout: "GRID" as const, shown: tiles.slice(0, tiles.length - (tiles.length % GRID_COLUMNS)) };
}

// Tiles whose aisles are empty at this store are hidden, keeping whole rows so the grid never has a gap
async function forStore(prisma: PrismaClient, storeId: string, collection: HeroCollection, wanted: HeroTileLayout = "GRID") {
  const stocked = await stockedSubcategories(prisma, storeId, collection.tiles.flatMap((t) => t.subcategoryIds));
  const tiles = collection.tiles
    .map((t) => ({ ...t, subcategories: t.subcategoryIds.flatMap((id) => stocked.get(id) ?? []) }))
    .filter((t) => t.subcategories.length > 0);
  const { tileLayout, shown } = layTiles(tiles, wanted);
  if (shown.length === 0) return null;
  const ta = (collection.translations as { ta?: { heroTitle?: string; heroKicker?: string; heroSubtitle?: string } } | null)?.ta;
  return {
    id: collection.id,
    title: collection.heroTitle ?? "",
    kicker: collection.heroKicker,
    subtitle: collection.heroSubtitle,
    translations: ta?.heroTitle ? { ta: { title: ta.heroTitle, kicker: ta.heroKicker, subtitle: ta.heroSubtitle } } : null,
    imageUrl: collection.heroImageUrl as string,
    theme: collection.heroTheme as { background: string; title: string; dark: boolean },
    tiles: shown.map(({ id, title, translations, imageUrl, subcategories }) => ({ id, title, translations, imageUrl, subcategories })),
    tileLayout,
  };
}

const HERO_SELECT = {
  id: true, kind: true, startsAt: true, endsAt: true, ...FESTIVAL_DAYS_SELECT, heroTitle: true, heroKicker: true, heroSubtitle: true, heroImageUrl: true, heroTheme: true, translations: true,
  tiles: { orderBy: { sortOrder: "asc" as const }, select: { id: true, title: true, translations: true, imageUrl: true, subcategoryIds: true } },
};

/** The home screen's festive heroes: up to three live festivals this store can stock, in rankFestivals order. */
export async function liveFestiveHeroes(
  prisma: PrismaClient, store: { id: string; organizationId: string }, now = new Date(), tileLayout: HeroTileLayout = "GRID",
) {
  const collections = await prisma.collection.findMany({ where: liveHeroWhere(store.organizationId, now), select: HERO_SELECT });
  const heroes = await Promise.all(rankFestivals(collections, now).map((c) => forStore(prisma, store.id, c, tileLayout)));
  return heroes.filter((h) => h !== null).slice(0, MAX_HEROES);
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
