import type { PrismaClient } from "../../generated/prisma/client.js";
import { liveWindow, reviewSummaries, withAllSizes, withReviews } from "./store-feed.js";

const GRID_COLUMNS = 3;
// A couple of fallbacks in case the soonest festival's tiles are all out of stock at this store
const CANDIDATES = 3;

type HeroCollection = {
  id: string; heroTitle: string | null; heroImageUrl: string | null; heroTheme: unknown; translations: unknown;
  tiles: { id: string; title: string; translations: unknown; imageUrl: string; subcategoryIds: string[] }[];
};

function liveHeroWhere(organizationId: string) {
  return {
    isActive: true,
    kind: { in: ["OCCASION" as const, "SEASON" as const] },
    heroImageUrl: { not: null },
    OR: [{ organizationId }, { organizationId: null }],
    AND: liveWindow(new Date()),
  };
}

async function stockedSubcategories(prisma: PrismaClient, storeId: string, subcategoryIds: string[]) {
  const rows = await prisma.product.findMany({
    where: { subcategoryId: { in: subcategoryIds }, isActive: true, storeProducts: { some: { storeId, isActive: true, stock: { gt: 0 } } } },
    select: { subcategoryId: true },
    distinct: ["subcategoryId"],
  });
  return new Set(rows.map((r) => r.subcategoryId));
}

// Tiles whose aisles are empty at this store are hidden, keeping whole rows so the grid never has a gap
async function forStore(prisma: PrismaClient, storeId: string, collection: HeroCollection) {
  const stocked = await stockedSubcategories(prisma, storeId, collection.tiles.flatMap((t) => t.subcategoryIds));
  const tiles = collection.tiles.filter((t) => t.subcategoryIds.some((id) => stocked.has(id)));
  const shown = tiles.slice(0, tiles.length - (tiles.length % GRID_COLUMNS));
  if (shown.length === 0) return null;
  const ta = (collection.translations as { ta?: { heroTitle?: string } } | null)?.ta?.heroTitle;
  return {
    id: collection.id,
    title: collection.heroTitle ?? "",
    translations: ta ? { ta: { title: ta } } : null,
    imageUrl: collection.heroImageUrl as string,
    theme: collection.heroTheme as { background: string; title: string; dark: boolean },
    tiles: shown.map(({ id, title, translations, imageUrl }) => ({ id, title, translations, imageUrl })),
  };
}

const HERO_SELECT = {
  id: true, heroTitle: true, heroImageUrl: true, heroTheme: true, translations: true,
  tiles: { orderBy: { sortOrder: "asc" as const }, select: { id: true, title: true, translations: true, imageUrl: true, subcategoryIds: true } },
};

/** The home screen's festive hero: the soonest-ending live festival (festivals before seasons) this store can stock. */
export async function liveFestiveHero(prisma: PrismaClient, store: { id: string; organizationId: string }) {
  const collections = await prisma.collection.findMany({
    where: liveHeroWhere(store.organizationId),
    orderBy: [{ kind: "asc" }, { endsAt: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
    take: CANDIDATES,
    select: HERO_SELECT,
  });
  for (const collection of collections) {
    const hero = await forStore(prisma, store.id, collection);
    if (hero) return hero;
  }
  return null;
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
