import { BUY_GET_PAGE_SIZE, HOME_DEALS_PAGE_SIZE, MOST_BOUGHT_LIST } from "@martly/shared/constants";
import type { WebShopQuery } from "@martly/shared/schemas";
import type { HomeTheme, PriceBandChip, WebBrandPage, WebBrandsPage, WebBrandTile, WebCollectionPage, WebListPage } from "@martly/shared/types";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { storeBrandBoost } from "../brand-boost.js";
import { rankedCollectionProductIds } from "../collection-products.js";
import { campaignLook } from "../home/campaign-look.js";
import { buyGetPage } from "../home/buy-get.js";
import { mostBought } from "../home/most-bought.js";
import { bandPage, dealsSection } from "../home/price-band.js";
import { autoTiles, stockedCollectionItems } from "../home/resolvers/campaign-tiles.js";
import { ownProductWhere } from "../own-brand.js";
import { liveWindow } from "../store-feed.js";
import { cardsInOrder, soldAt, type ShopContext } from "./cards.js";
import { filteredList } from "./category-filters.js";
import { storeDepartments } from "./pages.js";
import { storeBrandLabel } from "../store-brand-names.js";

const PAGE_SIZE = 24;
const POPULAR_BRANDS = 12;

const pages = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

/** Each product once, in the order its first listing comes */
const productIds = (listings: unknown[]) => [...new Set((listings as { productId: string }[]).map((l) => l.productId))];

const withQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const query = Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [`${k}=${encodeURIComponent(v)}`])).join("&");
  return query ? `${path}?${query}` : path;
};

async function categorySlugs(prisma: PrismaClient, chips: PriceBandChip[]) {
  const rows = await prisma.category.findMany({ where: { id: { in: chips.map((c) => c.categoryId) } }, select: { id: true, slug: true } });
  return new Map(rows.map((r) => [r.id, r.slug]));
}

async function categoryId(prisma: PrismaClient, slug: string | undefined) {
  if (!slug) return undefined;
  return (await prisma.category.findUnique({ where: { slug }, select: { id: true } }))?.id ?? null;
}

type Aisle = WebCollectionPage["aisles"][number];

/** A collection's aisle chips: a festival's own tiles, else aisles grouped from what the store stocks */
async function collectionAisles(prisma: PrismaClient, ctx: ShopContext, c: { id: string; slug: string; tiles: { id: string; title: string; imageUrl: string; subcategoryIds: string[] }[] }, q: WebShopQuery) {
  const path = `/collections/${c.slug}`;
  if (c.tiles.length) {
    const aisles: Aisle[] = c.tiles.map((t) => ({ label: t.title, imageUrl: t.imageUrl, slug: t.id, href: withQuery(path, { tile: t.id }), active: t.id === q.tile }));
    return { aisles, subcategoryIds: c.tiles.find((t) => t.id === q.tile)?.subcategoryIds ?? [] };
  }
  const tiles = await autoTiles(prisma, await stockedCollectionItems(prisma, c.id, ctx.store.id), true);
  const subs = await prisma.subcategory.findMany({ where: { id: { in: tiles.flatMap((t) => t.subcategoryIds) } }, select: { id: true, slug: true } });
  const slugOf = new Map(subs.map((s) => [s.id, s.slug]));
  const aisles: Aisle[] = tiles.map((t) => {
    const slug = t.subcategoryIds.flatMap((id) => slugOf.get(id) ?? []).join(",");
    return { label: t.label, imageUrl: t.images[0] ?? null, slug, href: withQuery(path, { aisle: slug }), active: slug === q.aisle };
  });
  const wanted = q.aisle?.split(",") ?? [];
  const picked = wanted.length ? await prisma.subcategory.findMany({ where: { slug: { in: wanted } }, select: { id: true } }) : [];
  return { aisles, subcategoryIds: picked.map((s) => s.id) };
}

/** A collection or festival at the shopper's store, an aisle at a time */
export async function collectionPage(prisma: PrismaClient, ctx: ShopContext, slug: string, q: WebShopQuery): Promise<WebCollectionPage | null> {
  const c = await prisma.collection.findFirst({
    where: { slug, isActive: true, AND: liveWindow(new Date()), OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] },
    select: {
      id: true, slug: true, title: true, subtitle: true, imageUrl: true, kind: true, endsAt: true, heroTheme: true,
      promo: { select: { discountType: true, discountValue: true } },
      tiles: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, imageUrl: true, subcategoryIds: true } },
    },
  });
  if (!c) return null;
  const [look, { aisles, subcategoryIds }] = await Promise.all([campaignLook(prisma, ctx.organizationId, c), collectionAisles(prisma, ctx, c, q)]);
  const ranked = await rankedCollectionProductIds(prisma, c.id, ctx.store.id, q.page, PAGE_SIZE, subcategoryIds);
  return {
    store: ctx.store,
    collection: {
      title: c.title, subtitle: c.subtitle, slug: c.slug, imageUrl: look?.imageUrl ?? c.imageUrl, endsAt: c.endsAt?.toISOString() ?? null,
      theme: look?.theme ?? (c.heroTheme as HomeTheme | null), offerLabel: look?.offerLabel ?? null,
    },
    aisles,
    products: await cardsInOrder(prisma, ctx.store.id, ranked.map((r) => r.id)),
    page: q.page,
    totalPages: pages(ranked[0]?.total ?? 0, PAGE_SIZE),
  };
}

/** A brand's products at the store, with its subcategories (largest first) as chips and the category filters */
async function brandListing(prisma: PrismaClient, ctx: ShopContext, brand: WebBrandPage["brand"], match: Prisma.ProductWhereInput, q: WebShopQuery) {
  const sold = { AND: [soldAt(ctx.store.id), match] };
  const rows = await prisma.subcategory.findMany({
    where: { products: { some: sold } },
    select: { name: true, slug: true, imageUrl: true, _count: { select: { products: { where: sold } } } },
  });
  if (!rows.length) return null;
  const subcategories = rows.map(({ _count, ...s }) => ({ ...s, count: _count.products })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const subcategory = subcategories.find((s) => s.slug === q.sub)?.slug ?? null;
  const where = { AND: [match, ...(subcategory ? [{ subcategory: { slug: subcategory } }] : [])] };
  const listing = await filteredList(prisma, ctx.store.id, where, q, PAGE_SIZE);
  return { store: ctx.store, brand, subcategories, subcategory, page: q.page, ...listing };
}

/** A brand's products at the shopper's store */
export async function brandPage(prisma: PrismaClient, ctx: ShopContext, slug: string, q: WebShopQuery): Promise<WebBrandPage | null> {
  const brand = await prisma.brand.findFirst({
    where: { slug, OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] },
    select: { id: true, name: true, slug: true, imageUrl: true },
  });
  if (!brand) return null;
  const { id, ...shown } = brand;
  return brandListing(prisma, ctx, shown, { brandId: id }, q);
}

/** The store as a brand, as in the app: its organisation's brands and the staples it packs itself */
export async function ownBrandPage(prisma: PrismaClient, ctx: ShopContext, q: WebShopQuery): Promise<WebBrandPage | null> {
  const boost = await storeBrandBoost(prisma, ctx.store.id);
  if (!boost.ownBrandIds.length && !boost.stapleSubcategoryIds.length) return null;
  const brand = { name: storeBrandLabel(ctx.store.id, ctx.store.name), slug: ctx.store.slug, imageUrl: ctx.store.logoUrl };
  return brandListing(prisma, ctx, brand, ownProductWhere(boost), q);
}

/** Every brand the store stocks: the shopper's brand directory at /brands */
export async function brandsPage(prisma: PrismaClient, ctx: ShopContext): Promise<WebBrandsPage | null> {
  const [rows, departments] = await Promise.all([
    prisma.$queryRaw<(WebBrandTile & { popularity: number })[]>`
      SELECT b.name, b.slug, b.image_url AS "imageUrl", b.theme_color AS "themeColor", b.popularity,
        COUNT(DISTINCT p.id)::int AS "productCount",
        COALESCE(array_agg(DISTINCT d.slug) FILTER (WHERE d.slug IS NOT NULL), '{}') AS departments
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN brands b ON b.id = p.brand_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      LEFT JOIN categories c ON c.id = s.category_id
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE sp.store_id = ${ctx.store.id} AND sp.is_active = true AND p.is_active = true AND p.is_draft = false
        AND (b.organization_id IS NULL OR b.organization_id = ${ctx.organizationId})
      GROUP BY b.id
      ORDER BY b.name ASC`,
    storeDepartments(prisma, ctx.store.id),
  ]);
  if (!rows.length) return null;
  const popular = [...rows]
    .sort((a, b) => b.popularity - a.popularity || Number(!!b.themeColor) - Number(!!a.themeColor) || b.productCount - a.productCount)
    .slice(0, POPULAR_BRANDS)
    .map((b) => b.slug);
  const covered = new Set(rows.flatMap((b) => b.departments));
  return {
    store: ctx.store,
    brands: rows.map(({ popularity: _, ...b }) => b),
    popular,
    departments: departments.filter((d) => covered.has(d.slug)),
  };
}

/** Every buy X get Y offer at the store, a category at a time */
export async function buyGetList(prisma: PrismaClient, ctx: ShopContext, q: WebShopQuery): Promise<WebListPage | null> {
  const category = await categoryId(prisma, q.category);
  if (category === null) return null;
  const list = await buyGetPage(prisma, { storeId: ctx.store.id, categoryId: category, page: q.page, now: new Date() });
  const slugs = await categorySlugs(prisma, list.chips);
  const chips = list.chips.map((c) => ({
    label: c.label, imageUrl: c.imageUrl, value: slugs.get(c.categoryId) ?? "", href: withQuery("/offers/buy-get", { category: slugs.get(c.categoryId) }),
    active: c.categoryId === category,
  }));
  return {
    store: ctx.store, title: "Buy more, get more free", subtitle: `Free-item offers at ${ctx.store.name}`, imageUrl: null,
    chips, products: await cardsInOrder(prisma, ctx.store.id, productIds(list.products)), page: q.page, totalPages: pages(list.total, BUY_GET_PAGE_SIZE),
  };
}

/** What the store's shoppers bought most over the last 30 days */
export async function bestSellers(prisma: PrismaClient, ctx: ShopContext): Promise<WebListPage> {
  const listings = await mostBought(prisma, ctx.store.id, MOST_BOUGHT_LIST);
  return {
    store: ctx.store, title: "Most bought", subtitle: `At ${ctx.store.name} this month`, imageUrl: null,
    chips: [], products: await cardsInOrder(prisma, ctx.store.id, productIds(listings)), page: 1, totalPages: 1,
  };
}

/** A Home price-band deals section in full: a band and category at a time */
export async function dealsList(prisma: PrismaClient, ctx: ShopContext, sectionId: string, q: WebShopQuery): Promise<WebListPage | null> {
  const now = new Date();
  const [deals, category] = await Promise.all([
    dealsSection(prisma, { id: ctx.store.id, organizationId: ctx.organizationId }, sectionId, now),
    categoryId(prisma, q.category),
  ]);
  if (!deals || category === null || q.band >= deals.bands.length) return null;
  const list = await bandPage(prisma, { storeId: ctx.store.id, collectionId: deals.collectionId, maxPrice: deals.bands[q.band].maxPrice, categoryId: category, now }, q.page);
  const path = `/deals/${sectionId}`;
  const slugs = await categorySlugs(prisma, list.chips);
  const band = q.band || undefined;
  return {
    store: ctx.store, title: deals.title ?? deals.headline ?? "Deals", subtitle: deals.title ? deals.headline : null, imageUrl: null,
    bands: deals.bands.map((b, i) => ({ label: b.label, imageUrl: null, value: b.id, href: withQuery(path, { band: i || undefined }), active: i === q.band })),
    chips: list.chips.map((c) => ({
      label: c.label, imageUrl: c.imageUrl, value: slugs.get(c.categoryId) ?? "", href: withQuery(path, { band, category: slugs.get(c.categoryId) }),
      active: c.categoryId === category,
    })),
    products: await cardsInOrder(prisma, ctx.store.id, productIds(list.products)),
    page: q.page,
    totalPages: pages(list.total, HOME_DEALS_PAGE_SIZE),
  };
}
