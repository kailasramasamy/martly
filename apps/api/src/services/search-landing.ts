import type { PrismaClient } from "../../generated/prisma/client.js";
import { getTimePeriod, TIME_CATEGORY_MAP, TIME_PERIOD_TITLES } from "./time-picks.js";
import { liveWindow, reviewSummaries, withAllSizes, withReviews } from "./store-feed.js";
import { predictReorders } from "./reorder.js";

const CACHE_TTL_MS = 10 * 60_000;
const TRENDING_LIMIT = 8;
const CATEGORY_LIMIT = 12;
const RAIL_LIMIT = 12;
const OCCASION_LIMIT = 2;

// Only the parts that are the same for every customer are cached; reorder is per user
const sharedCache = new Map<string, { at: number; data: Awaited<ReturnType<typeof buildShared>> }>();

async function trendingQueries(prisma: PrismaClient, storeId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ query: string }[]>`
    SELECT query FROM search_logs
    WHERE store_id = ${storeId} AND result_count > 0 AND created_at > now() - interval '7 days'
    GROUP BY query
    ORDER BY COUNT(DISTINCT COALESCE(user_id, id)) DESC, MAX(created_at) DESC
    LIMIT ${TRENDING_LIMIT}`;
  return rows.map((r) => r.query);
}

// Best sellers over 30 days, topped up with the subcategories this store stocks most of
async function popularSubcategories(prisma: PrismaClient, storeId: string) {
  const ranked = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT p.subcategory_id AS id, SUM(oi.quantity) AS score, 0 AS tier
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
        AND p.subcategory_id IS NOT NULL
      GROUP BY p.subcategory_id
      UNION ALL
      SELECT p.subcategory_id, COUNT(DISTINCT p.id), 1
      FROM store_products sp JOIN products p ON p.id = sp.product_id
      WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock > 0 AND p.is_active AND p.subcategory_id IS NOT NULL
      GROUP BY p.subcategory_id
    ) ranked
    GROUP BY id
    ORDER BY MIN(tier), MAX(CASE WHEN tier = 0 THEN score END) DESC NULLS LAST, MAX(score) DESC
    LIMIT ${CATEGORY_LIMIT}`;
  const ids = ranked.map((r) => r.id);
  const subs = await prisma.subcategory.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, imageUrl: true, translations: true },
  });
  const byId = new Map(subs.map((s) => [s.id, s]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

function inStore(storeId: string) {
  return { isActive: true, storeProducts: { some: { storeId, isActive: true, stock: { gt: 0 } } } };
}

// The aisles a festival rail draws from, in rail order, so shoppers can jump to the full shelf
function occasionSubcategories<T extends { id: string }>(subs: (T | null)[]) {
  const seen = new Map<string, T>();
  for (const s of subs) if (s && !seen.has(s.id)) seen.set(s.id, s);
  return [...seen.values()];
}

async function occasionCollections(prisma: PrismaClient, storeId: string, organizationId: string) {
  const collections = await prisma.collection.findMany({
    where: {
      isActive: true,
      kind: { in: ["OCCASION", "SEASON"] },
      OR: [{ organizationId }, { organizationId: null }],
      AND: liveWindow(new Date()),
    },
    // OCCASION sorts before SEASON in the enum, so festivals lead; among overlapping festivals the one
    // ending soonest is the most urgent (Navratri before the Diwali run-up)
    orderBy: [{ kind: "asc" }, { endsAt: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
    include: {
      items: {
        where: { product: inStore(storeId) },
        orderBy: { sortOrder: "asc" },
        take: RAIL_LIMIT,
        select: { productId: true, product: { select: { subcategory: { select: { id: true, name: true, translations: true } } } } },
      },
    },
  });
  const live = collections.filter((c) => c.items.length > 0).slice(0, OCCASION_LIMIT);
  return Promise.all(live.map(async (c) => ({
    id: c.id, title: c.title, subtitle: c.subtitle, slug: c.slug, kind: c.kind, translations: c.translations,
    imageUrl: c.imageUrl, imageUrls: c.imageUrls as Record<string, string> | null, textInImage: c.textInImage,
    subcategories: occasionSubcategories(c.items.map((i) => i.product.subcategory)),
    products: await withAllSizes(prisma, storeId, c.items),
  })));
}

async function timePicks(prisma: PrismaClient, storeId: string) {
  const period = getTimePeriod();
  const subs = await prisma.subcategory.findMany({
    where: { name: { in: TIME_CATEGORY_MAP[period], mode: "insensitive" } },
    select: { products: { where: inStore(storeId), take: 3, select: { id: true } } },
  });
  // Round-robin across subcategories so the rail mixes milk, bread, eggs… instead of 12 curds
  const columns = subs.map((s) => s.products.map((p) => p.id));
  const ids: string[] = [];
  for (let i = 0; ids.length < RAIL_LIMIT && columns.some((c) => c[i]); i++) {
    for (const c of columns) if (c[i] && ids.length < RAIL_LIMIT) ids.push(c[i]);
  }
  const products = await withAllSizes(prisma, storeId, ids.map((productId) => ({ productId })));
  return { period, title: TIME_PERIOD_TITLES[period], products };
}

async function buildShared(prisma: PrismaClient, storeId: string, organizationId: string) {
  const [trending, categories, occasions, time] = await Promise.all([
    trendingQueries(prisma, storeId),
    popularSubcategories(prisma, storeId),
    occasionCollections(prisma, storeId, organizationId),
    timePicks(prisma, storeId),
  ]);
  // Too few real searches yet: lead with what sells here so new stores still show chips
  const fill = categories.map((c) => c.name).filter((n) => !trending.includes(n.toLowerCase()));
  return { trending: [...trending, ...fill].slice(0, TRENDING_LIMIT), categories, occasions, timePicks: time };
}

async function reorderRail(prisma: PrismaClient, userId: string, storeId: string) {
  const predictions = await predictReorders(prisma, userId, storeId);
  const products = await withAllSizes(prisma, storeId, predictions.slice(0, RAIL_LIMIT));
  const dueCount = predictions.filter((p) => p.status !== "not_yet").length;
  return { dueCount, products };
}

export async function buildSearchLanding(prisma: PrismaClient, store: { id: string; organizationId: string }, userId?: string) {
  const cached = sharedCache.get(store.id);
  const sharedPromise = cached && Date.now() - cached.at < CACHE_TTL_MS
    ? Promise.resolve(cached.data)
    : buildShared(prisma, store.id, store.organizationId).then((data) => {
        sharedCache.set(store.id, { at: Date.now(), data });
        return data;
      });
  const [shared, reorder] = await Promise.all([
    sharedPromise,
    userId ? reorderRail(prisma, userId, store.id) : Promise.resolve({ dueCount: 0, products: [] }),
  ]);
  const productIds = [
    ...reorder.products, ...shared.timePicks.products, ...shared.occasions.flatMap((o) => o.products),
  ].map((p: any) => p.productId as string);
  const reviews = await reviewSummaries(prisma, productIds);
  return {
    ...shared,
    reorder: { ...reorder, products: withReviews(reorder.products, reviews) },
    occasions: shared.occasions.map((o) => ({ ...o, products: withReviews(o.products, reviews) })),
    timePicks: { ...shared.timePicks, products: withReviews(shared.timePicks.products, reviews) },
  };
}
