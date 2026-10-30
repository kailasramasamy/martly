import type { StoreWalkDepartment, StoreWalkStop } from "@martly/shared/types";
import { ownBrandId } from "@martly/shared/constants";
import { storeBrandBoost, type BrandBoost } from "./brand-boost.js";
import { brandPopularitySql, storeRegion } from "./brand-popularity.js";
import type { StoreWalkRouteInput } from "@martly/shared/schemas";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { recentStoreSales } from "./home/most-bought.js";
import { ownBrand, ownProductSql } from "./own-brand.js";
import { dueInStock } from "./reorder.js";
import { searchAisleProducts } from "./search.js";
import { decorateStoreProducts, storeProductInclude } from "./store-product-view.js";

const DUE_LIMIT = 8;
// Five full shelves of three, across the aisle or once the shopper picks a subcategory or brand
const POPULAR_LIMIT = 15;
// Candidates read before the per-aisle spread, so a dal aisle isn't eight toor dals
const POPULAR_CANDIDATES = 40;
const POPULAR_PER_SUBCATEGORY = 2;
// The store's own brand leads the aisle, two shelves at most so its other brands still show
const OWN_LEAD = 6;
// A search on the shelves: eight full rows of matches, read from the ranked list's head
const SEARCH_LIMIT = 24;
const SEARCH_CANDIDATES = 60;

type Translations = StoreWalkStop["translations"];
type AisleRow = {
  categoryId: string; name: string; translations: Translations; imageUrl: string | null; stocked: number;
  departmentId: string; departmentName: string; departmentTranslations: Translations; departmentImageUrl: string | null;
  departmentAisleImageUrl: string | null;
};
type DueRow = Awaited<ReturnType<typeof dueInStock>>[number];

// Every category with stock at the store, in shelf order, with how many products it has
function stockedAisles(prisma: PrismaClient, storeId: string) {
  return prisma.$queryRaw<AisleRow[]>`
    WITH stocked AS (
      SELECT DISTINCT p.id, s.category_id FROM store_products sp
      JOIN products p ON p.id = sp.product_id AND p.is_active
      JOIN subcategories s ON s.id = p.subcategory_id
      WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0
    )
    SELECT c.id AS "categoryId", c.name, c.translations, c.image_url AS "imageUrl", COUNT(*)::int AS stocked,
      d.id AS "departmentId", d.name AS "departmentName", d.translations AS "departmentTranslations",
      d.image_url AS "departmentImageUrl", d.aisle_image_url AS "departmentAisleImageUrl"
    FROM stocked st
    JOIN categories c ON c.id = st.category_id
    JOIN departments d ON d.id = c.department_id
    GROUP BY c.id, d.id
    ORDER BY d.sort_order, d.name, c.sort_order, c.name`;
}

type Reach = { shoppers: number; orders: number };

// How many shoppers, and orders, bought from each department here over 90 days: the households' everyday department
// (staples) wins over one a few shoppers buy a lot from
async function departmentReach(prisma: PrismaClient, storeId: string) {
  const rows = await prisma.$queryRaw<(Reach & { id: string })[]>`
    SELECT c.department_id AS id, COUNT(DISTINCT o.user_id)::int AS shoppers, COUNT(DISTINCT o.id)::int AS orders
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id
    WHERE o.store_id = ${storeId} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '90 days'
    GROUP BY c.department_id`;
  return new Map(rows.map((r) => [r.id, r]));
}

function walkBasics(prisma: PrismaClient, storeId: string, userId: string | null) {
  return Promise.all([
    stockedAisles(prisma, storeId),
    userId ? dueInStock(prisma, userId, storeId) : Promise.resolve([] as DueRow[]),
    departmentReach(prisma, storeId),
  ]);
}

const categoryOf = (sp: { product: { subcategory: { categoryId: string } | null } }) => sp.product.subcategory?.categoryId;

function countBy<T>(rows: T[], key: (row: T) => string | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

// Departments in shelf order, each with its aisle count and due items
function departmentsOf(aisles: AisleRow[], dueByAisle: Map<string, number>) {
  const departments = new Map<string, StoreWalkDepartment>();
  for (const a of aisles) {
    const d = departments.get(a.departmentId)
      ?? {
        id: a.departmentId, name: a.departmentName, translations: a.departmentTranslations, imageUrl: a.departmentImageUrl,
        aisleImageUrl: a.departmentAisleImageUrl,
        aisleCount: 0, dueCount: 0,
      };
    d.aisleCount += 1;
    d.dueCount += dueByAisle.get(a.categoryId) ?? 0;
    departments.set(a.departmentId, d);
  }
  return [...departments.values()];
}

// The asked-for department, else the one with most due items, else the one most shoppers buy from, else the biggest
function pickDepartment(departments: StoreWalkDepartment[], reach: Map<string, Reach>, asked?: string) {
  if (asked && departments.some((d) => d.id === asked)) return asked;
  const r = (d: StoreWalkDepartment) => reach.get(d.id) ?? { shoppers: 0, orders: 0 };
  const ranked = [...departments].sort((a, b) =>
    b.dueCount - a.dueCount || r(b).shoppers - r(a).shoppers || r(b).orders - r(a).orders || b.aisleCount - a.aisleCount);
  return ranked[0]?.id ?? null;
}

async function cartAisleIds(prisma: PrismaClient, storeId: string, storeProductIds: string[]) {
  if (storeProductIds.length === 0) return { productIds: new Set<string>(), aisleIds: new Set<string>() };
  const rows = await prisma.storeProduct.findMany({
    where: { storeId, id: { in: storeProductIds } },
    select: { productId: true, product: { select: { subcategory: { select: { categoryId: true } } } } },
  });
  return {
    productIds: new Set(rows.map((r) => r.productId)),
    aisleIds: new Set(rows.flatMap((r) => categoryOf(r) ?? [])),
  };
}

/**
 * One department's aisles in shelf order, with the shopper's due items and what the cart already covers. Departments
 * list every one with stock, so the shopper can switch. Null when the store has nothing in stock.
 */
export async function walkRoute(prisma: PrismaClient, storeId: string, userId: string | null, input: StoreWalkRouteInput) {
  const [[aisles, dueAll, reach], cart] = await Promise.all([
    walkBasics(prisma, storeId, userId),
    cartAisleIds(prisma, storeId, input.cartStoreProductIds),
  ]);
  const due = dueAll.filter((sp) => !cart.productIds.has(sp.productId));
  const dueByAisle = countBy(due, categoryOf);
  const departments = departmentsOf(aisles, dueByAisle);
  const departmentId = pickDepartment(departments, reach, input.departmentId);
  if (!departmentId) return null;
  const inDepartment = aisles.filter((a) => a.departmentId === departmentId);
  const packs = await aislePacks(prisma, storeId, inDepartment.map((a) => a.categoryId), STOP_PACKS);
  const stops: StoreWalkStop[] = inDepartment.map((a) => ({
    categoryId: a.categoryId, name: a.name, translations: a.translations, imageUrl: a.imageUrl, stocked: a.stocked,
    packs: packs.get(a.categoryId) ?? [], dueCount: dueByAisle.get(a.categoryId) ?? 0, inCart: cart.aisleIds.has(a.categoryId),
  }));
  const open = stops.filter((s) => !s.inCart);
  return {
    departmentId,
    departments,
    stops,
    cartAisles: cart.aisleIds.size,
    uncovered: open.length,
    uncoveredDue: open.reduce((sum, s) => sum + s.dueCount, 0),
    due: await decorateStoreProducts(prisma, due.slice(0, DUE_LIMIT)),
  };
}

type AisleFilter = { categoryId: string; subcategoryId?: string; brandId?: string; q?: string };

// One brand's products, or the store's own ("Our brand": its brands and the staples it packs)
function brandSql(storeId: string, brandId: string | undefined, boost: BrandBoost) {
  if (!brandId) return Prisma.empty;
  return Prisma.sql`AND ${brandId === ownBrandId(storeId) ? ownProductSql(boost) : Prisma.sql`p.brand_id = ${brandId}`}`;
}

// What a search finds on the shelves on show, in the store search's ranking, each product as its best-stocked size
async function searchedIn(prisma: PrismaClient, storeId: string, { q, brandId, ...aisle }: AisleFilter, boost: BrandBoost) {
  const ranked = (await searchAisleProducts(prisma, storeId, { ...aisle, brand: brandSql(storeId, brandId, boost) }, q!)).productIds.slice(0, SEARCH_CANDIDATES);
  const listings = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, productId: { in: ranked }, product: { isActive: true } },
    include: storeProductInclude,
  });
  const best = new Map<string, (typeof listings)[number]>();
  for (const sp of listings) {
    const available = sp.stock - sp.reservedStock;
    const held = best.get(sp.productId);
    if (available > 0 && (!held || available > held.stock - held.reservedStock)) best.set(sp.productId, sp);
  }
  const picked = ranked.flatMap((id) => best.get(id) ?? []).slice(0, SEARCH_LIMIT);
  return decorateStoreProducts(prisma, picked);
}

// The store's own brand's best first, then the aisle's packs by brand popularity in the store's region, then 30-day units
// and stock, each as its best-stocked size. Popularity leads because a store's few early orders would otherwise put
// whatever sold once ahead of the brands its shoppers know. Across the whole aisle they're spread over its
// subcategories; within one subcategory or brand they're simply its best
async function popularIn(
  prisma: PrismaClient, storeId: string, { categoryId, subcategoryId, brandId }: AisleFilter, boost: BrandBoost, skipProductIds: string[],
) {
  const region = await storeRegion(prisma, storeId);
  const candidates = await prisma.$queryRaw<{ id: string; subcategoryId: string; lead: boolean }[]>`
    SELECT id, "subcategoryId", lead FROM (
    SELECT *, own AND ROW_NUMBER() OVER (PARTITION BY own ORDER BY popularity DESC, units DESC, available DESC, id) <= ${OWN_LEAD} AS lead
    FROM (
      SELECT DISTINCT ON (p.id) sp.id, p.subcategory_id AS "subcategoryId", ${ownProductSql(boost)} AS own, COALESCE(sales.qty, 0) AS units,
        ${brandPopularitySql(region)} AS popularity, sp.stock - sp.reserved_stock AS available
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id AND p.is_active AND p.image_url IS NOT NULL
      JOIN subcategories s ON s.id = p.subcategory_id AND s.category_id = ${categoryId}
        ${subcategoryId ? Prisma.sql`AND s.id = ${subcategoryId}` : Prisma.empty}
        ${brandSql(storeId, brandId, boost)}
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN (${recentStoreSales(storeId)}) sales ON sales.product_id = p.id
      WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0
        AND p.id <> ALL(${skipProductIds}::text[])
      ORDER BY p.id, sp.stock - sp.reserved_stock DESC
    ) best
    ) ranked
    ORDER BY lead DESC, popularity DESC, units DESC, available DESC, id
    LIMIT ${POPULAR_CANDIDATES}`;
  const narrowed = !!(subcategoryId || brandId);
  const lead = candidates.filter((c) => c.lead);
  const rest = candidates.filter((c) => !c.lead);
  const perSubcategory = new Map<string, number>();
  const spread = narrowed ? rest : rest.filter((c) => {
    const n = perSubcategory.get(c.subcategoryId) ?? 0;
    perSubcategory.set(c.subcategoryId, n + 1);
    return n < POPULAR_PER_SUBCATEGORY;
  });
  // A small aisle with one or two subcategories still fills its shelf
  const picked = [...lead, ...spread, ...rest.filter((c) => !spread.includes(c))].slice(0, POPULAR_LIMIT).map((c) => c.id);
  const rows = await prisma.storeProduct.findMany({ where: { id: { in: picked } }, include: storeProductInclude });
  return decorateStoreProducts(prisma, rows.sort((a, b) => picked.indexOf(a.id) - picked.indexOf(b.id)));
}

const ENDCAP_LIMIT = 3;
const ENDCAP_CANDIDATES = 40;

// Running offers in the rest of the department, for the display at the end of the aisle: buy X get Y first, then the
// biggest saving. Only real offers (a store discount or a multi-buy), never a plain saving on MRP
async function endcapDeals(prisma: PrismaClient, storeId: string, departmentId: string, categoryId: string) {
  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT ON (p.id) sp.id
    FROM store_products sp
    JOIN products p ON p.id = sp.product_id AND p.is_active AND p.image_url IS NOT NULL
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id AND c.department_id = ${departmentId} AND c.id <> ${categoryId}
    WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0
      AND ((sp.offer_buy_qty IS NOT NULL AND (sp.offer_start IS NULL OR sp.offer_start <= now()) AND (sp.offer_end IS NULL OR sp.offer_end >= now()))
        OR (sp.discount_type IS NOT NULL AND (sp.discount_start IS NULL OR sp.discount_start <= now()) AND (sp.discount_end IS NULL OR sp.discount_end >= now())))
    ORDER BY p.id, sp.stock - sp.reserved_stock DESC
    LIMIT ${ENDCAP_CANDIDATES}`;
  const rows = await prisma.storeProduct.findMany({ where: { id: { in: ids.map((r) => r.id) } }, include: storeProductInclude });
  const deals = (await decorateStoreProducts(prisma, rows)).filter((sp) => sp.pricing.offer || sp.pricing.discountActive);
  const rank = (sp: (typeof deals)[number]) => (sp.pricing.offer ? 100 : sp.pricing.savingsPercent);
  return deals.sort((a, b) => rank(b) - rank(a)).slice(0, ENDCAP_LIMIT);
}

const BRAND_LIMIT = 20;

// The brands on the aisle's shelves (or one subcategory's), for the brand filter: the store's own brand first (its
// brands and the staples it packs, under its logo), then the others by popularity in the store's region and sales
async function stockedBrands(prisma: PrismaClient, storeId: string, { categoryId, subcategoryId }: AisleFilter, boost: BrandBoost) {
  const region = await storeRegion(prisma, storeId);
  const stocked = Prisma.sql`
    SELECT DISTINCT p.id, p.brand_id, ${ownProductSql(boost)} AS own FROM store_products sp
    JOIN products p ON p.id = sp.product_id AND p.is_active
    JOIN subcategories s ON s.id = p.subcategory_id AND s.category_id = ${categoryId}
      ${subcategoryId ? Prisma.sql`AND s.id = ${subcategoryId}` : Prisma.empty}
    WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0`;
  const [[{ count: ownCount }], others, own] = await Promise.all([
    prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM (${stocked}) stocked WHERE own`,
    prisma.$queryRaw<{ id: string; name: string; imageUrl: string | null; count: number }[]>`
      SELECT b.id, b.name, b.image_url AS "imageUrl", COUNT(*)::int AS count
      FROM (${stocked}) stocked
      JOIN brands b ON b.id = stocked.brand_id
      LEFT JOIN (${recentStoreSales(storeId)}) sales ON sales.product_id = stocked.id
      WHERE NOT stocked.own
      GROUP BY b.id
      ORDER BY ${brandPopularitySql(region)} DESC, COALESCE(SUM(sales.qty), 0) DESC, COUNT(*) DESC, b.name
      LIMIT ${BRAND_LIMIT}`,
    ownBrand(prisma, storeId),
  ]);
  return ownCount && own ? [{ id: own.id, name: own.name, imageUrl: own.imageUrl, count: ownCount }, ...others] : others;
}

type SubcategoryRow = { id: string; name: string; translations: Translations; imageUrl: string | null; stocked: number };

// The aisle's subcategories with stock here, in shelf order
function stockedSubcategories(prisma: PrismaClient, storeId: string, categoryId: string) {
  return prisma.$queryRaw<SubcategoryRow[]>`
    SELECT s.id, s.name, s.translations, s.image_url AS "imageUrl", COUNT(DISTINCT p.id)::int AS stocked
    FROM subcategories s
    JOIN products p ON p.subcategory_id = s.id AND p.is_active
    JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0
    WHERE s.category_id = ${categoryId}
    GROUP BY s.id
    ORDER BY s.sort_order, s.name`;
}

/**
 * One aisle: the shopper's due items in it, its subcategories, its best sellers (or one subcategory's, when asked),
 * and the offers for the display at its end. Null when the category has no stock here.
 */
export async function walkAisle(prisma: PrismaClient, storeId: string, userId: string | null, filter: AisleFilter) {
  const [category, subcategories, dueAll] = await Promise.all([
    prisma.category.findUnique({ where: { id: filter.categoryId }, select: { id: true, name: true, translations: true, departmentId: true } }),
    stockedSubcategories(prisma, storeId, filter.categoryId),
    userId ? dueInStock(prisma, userId, storeId) : Promise.resolve([] as DueRow[]),
  ]);
  if (!category || subcategories.length === 0) return null;
  const dueRows = dueAll.filter((sp) => categoryOf(sp) === filter.categoryId);
  const boost = await storeBrandBoost(prisma, storeId);
  const [due, popular, endcap, brands] = await Promise.all([
    decorateStoreProducts(prisma, dueRows),
    filter.q ? searchedIn(prisma, storeId, filter, boost) : popularIn(prisma, storeId, filter, boost, dueRows.map((sp) => sp.productId)),
    endcapDeals(prisma, storeId, category.departmentId, category.id),
    stockedBrands(prisma, storeId, filter, boost),
  ]);
  const stocked = subcategories.reduce((n, sc) => n + sc.stocked, 0);
  return {
    category: { ...category, translations: category.translations as Translations }, stocked, subcategories, brands, due, popular, endcap,
  };
}

const SHELVES = 4;
const SHELF_PACKS = 4;
const STOP_PACKS = 5;

// Photos of each aisle's best sellers here (30-day units, then stock), for the shelves the walk draws
async function aislePacks(prisma: PrismaClient, storeId: string, categoryIds: string[], perAisle: number) {
  const rows = await prisma.$queryRaw<{ categoryId: string; images: string[] }[]>`
    SELECT category_id AS "categoryId", (ARRAY_AGG(image_url ORDER BY qty DESC, available DESC, id))[1:${perAisle}] AS images
    FROM (
      SELECT DISTINCT ON (p.id) p.id, p.image_url, s.category_id, COALESCE(sales.qty, 0) AS qty, sp.stock - sp.reserved_stock AS available
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id AND p.is_active AND p.image_url IS NOT NULL
      JOIN subcategories s ON s.id = p.subcategory_id AND s.category_id = ANY(${categoryIds}::text[])
      LEFT JOIN (${recentStoreSales(storeId)}) sales ON sales.product_id = p.id
      WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock > 0
      ORDER BY p.id, sp.stock - sp.reserved_stock DESC
    ) pictured
    GROUP BY category_id`;
  return new Map(rows.map((r) => [r.categoryId, r.images]));
}

/** For the Home card: the department a walk starts in, its aisle count, the shopper's due items (all departments), shelves */
export async function walkTeaser(prisma: PrismaClient, storeId: string, userId: string | null) {
  const [aisles, due, reach] = await walkBasics(prisma, storeId, userId);
  const departments = departmentsOf(aisles, countBy(due, categoryOf));
  const start = departments.find((d) => d.id === pickDepartment(departments, reach));
  if (!start) return null;
  const startAisles = aisles.filter((a) => a.departmentId === start.id).map((a) => a.categoryId);
  return {
    departmentId: start.id, departmentName: start.name, departmentTranslations: start.translations,
    aisleCount: start.aisleCount, dueCount: due.length,
    // The first aisles in shelf order with a full shelf of photos
    shelves: await aislePacks(prisma, storeId, startAisles, SHELF_PACKS)
      .then((packs) => startAisles.map((id) => packs.get(id) ?? []).filter((p) => p.length === SHELF_PACKS).slice(0, SHELVES)),
  };
}
