import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { WebCategoryPage, WebDepartment, WebDepartmentTree, WebProductBrand, WebProductPage, WebShelf, WebShopStore, WebSitemap } from "@martly/shared/types";
import { liveWindow } from "../store-feed.js";
import { storeBrandOf } from "../own-brand.js";
import { storePack } from "../pack-images.js";
import { packTileImages } from "../pack-tiles/index.js";
import { resolveStore, webStoreWhere } from "../store-resolve.js";
import type { WebShopQuery } from "@martly/shared/schemas";
import { cardSelect, productCards, soldAt, toCard } from "./cards.js";
import { filteredList } from "./category-filters.js";
import { productInfo, productInfoSelect } from "./product-info.js";

const SHELF_SIZE = 10;
const PAGE_SIZE = 24;
const withImage: Prisma.ProductWhereInput = { imageUrl: { not: null } };

/** Departments and their categories, keeping only those the store has something in */
export async function departmentTrees(prisma: PrismaClient, storeId: string, slug?: string): Promise<WebDepartmentTree[]> {
  const departments = await prisma.department.findMany({
    where: slug ? { slug } : {},
    orderBy: { sortOrder: "asc" },
    select: {
      name: true, slug: true, imageUrl: true,
      categories: {
        where: { subcategories: { some: { products: { some: soldAt(storeId) } } } },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, imageUrl: true },
      },
    },
  });
  // Two of the store's own packs where the category has them, as in the app
  const packTiles = await packTileImages(prisma, storeId, departments.flatMap((d) => d.categories.map((c) => c.id)));
  return departments.filter((d) => d.categories.length > 0).map((d) => ({
    ...d,
    categories: d.categories.map(({ id, imageUrl, ...c }) => ({ ...c, imageUrl: packTiles.get(id) ?? imageUrl })),
  }));
}

/** The departments the store has something in, for the site's department bar */
export function storeDepartments(prisma: PrismaClient, storeId: string): Promise<WebDepartment[]> {
  return prisma.department.findMany({
    where: { categories: { some: { subcategories: { some: { products: { some: soldAt(storeId) } } } } } },
    orderBy: { sortOrder: "asc" },
    select: { name: true, slug: true, imageUrl: true },
  });
}

async function shelf(prisma: PrismaClient, storeId: string, name: string, path: string, where: Prisma.ProductWhereInput): Promise<WebShelf> {
  const products = await productCards(prisma, storeId, { where: { AND: [withImage, where] }, take: SHELF_SIZE });
  return { name, path, products };
}

/** A department: a shelf per category */
export async function departmentPage(prisma: PrismaClient, store: WebShopStore, slug: string) {
  const [department] = await departmentTrees(prisma, store.id, slug);
  if (!department) return null;
  const shelves = await Promise.all(department.categories.map((c) =>
    shelf(prisma, store.id, c.name, `/c/${slug}/${c.slug}`, { subcategory: { category: { slug: c.slug } } })));
  return { store, department, shelves: shelves.filter((s) => s.products.length > 0) };
}

/** A category's products, narrowed to one subcategory when asked, then by the shopper's filters, a page at a time */
export async function categoryPage(prisma: PrismaClient, store: WebShopStore, slugs: { department: string; category: string }, q: WebShopQuery): Promise<WebCategoryPage | null> {
  const category = await prisma.category.findFirst({
    where: { slug: slugs.category, department: { slug: slugs.department } },
    select: {
      name: true, slug: true, imageUrl: true,
      department: { select: { name: true, slug: true, imageUrl: true } },
      subcategories: {
        orderBy: { sortOrder: "asc" },
        select: { name: true, slug: true, imageUrl: true, _count: { select: { products: { where: soldAt(store.id) } } } },
      },
    },
  });
  if (!category) return null;
  const subcategories = category.subcategories.filter((s) => s._count.products > 0).map(({ _count, ...s }) => ({ ...s, count: _count.products }));
  const subcategory = subcategories.find((s) => s.slug === q.sub)?.slug ?? null;
  const where: Prisma.ProductWhereInput = { subcategory: subcategory ? { slug: subcategory } : { category: { slug: category.slug } } };
  const listing = await filteredList(prisma, store.id, where, q, PAGE_SIZE);
  const { name, imageUrl, department } = category;
  return { store, department, category: { name, slug: category.slug, imageUrl }, subcategories, subcategory, page: q.page, ...listing };
}

const productSelect = (storeId: string) => ({
  ...cardSelect(storeId),
  ...productInfoSelect,
  images: true, subcategoryId: true, brandId: true,
  brand: { select: { name: true, slug: true, imageUrl: true, themeColor: true } },
  subcategory: { select: { name: true, slug: true, category: { select: { name: true, slug: true, department: { select: { name: true, slug: true } } } } } },
}) satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: ReturnType<typeof productSelect> }>;

function trail(p: ProductRow) {
  const sub = p.subcategory;
  if (!sub) return [];
  const dept = `/c/${sub.category.department.slug}`;
  const cat = `${dept}/${sub.category.slug}`;
  return [
    { name: sub.category.department.name, path: dept },
    { name: sub.category.name, path: cat },
    { name: sub.name, path: `${cat}?sub=${sub.slug}` },
  ];
}

/** A product any live store sells, priced at the shopper's store (no packs when that store doesn't sell it) */
/** The product's brand and its store; a staple the store packs itself carries the store as its brand, as in the app */
async function productBrand(prisma: PrismaClient, store: WebShopStore, p: ProductRow): Promise<WebProductBrand | null> {
  if (p.brand) {
    const { slug, ...brand } = p.brand;
    return { ...brand, href: `/brands/${slug}` };
  }
  const own = await storeBrandOf(prisma, store.id, p);
  return own && { name: own.name, imageUrl: own.imageUrl, themeColor: own.themeColor, href: `/${store.town.slug}/${store.slug}/brand` };
}

export async function productPage(prisma: PrismaClient, store: WebShopStore, slug: string): Promise<WebProductPage | null> {
  const p = await prisma.product.findFirst({
    where: { slug, isActive: true, isDraft: false, storeProducts: { some: { isActive: true, store: webStoreWhere() } } },
    select: productSelect(store.id),
  });
  if (!p) return null;
  const [related, brand] = await Promise.all([
    p.subcategoryId ? productCards(prisma, store.id, { where: { subcategoryId: p.subcategoryId, id: { not: p.id } }, take: SHELF_SIZE }) : [],
    productBrand(prisma, store, p),
  ]);
  const { packs, ...card } = toCard(p);
  // The store's own packs, front then back for each size, replace the catalog photos, as in the app
  const own = [...p.storeProducts].sort((a, b) => Number(a.price) - Number(b.price)).flatMap((sp) => {
    const pack = storePack(sp.storeId, sp.variantId);
    return pack ? [pack.front, ...(pack.back ? [pack.back] : [])] : [];
  });
  const images = [...new Set((own.length ? own : [card.imageUrl, ...p.images]).filter((u): u is string => Boolean(u)))];
  return {
    store,
    product: {
      ...card, description: p.description, images, foodType: p.foodType, trail: trail(p),
      info: productInfo(p, { brand: brand?.name ?? null, category: p.subcategory?.name ?? null, packs: packs.map((pk) => pk.name) }),
    },
    packs,
    brand,
    related,
  };
}

/** Every page worth indexing: departments, categories and products some store on martlyshop.in sells */
/** Brands and collections a visitor without a store (a search engine) can open: those of the store they are given */
async function crawlerLists(prisma: PrismaClient) {
  const resolution = await resolveStore(prisma, {}, webStoreWhere());
  if (!resolution) return { collections: [], brands: [] };
  const { id, organizationId } = resolution.store;
  const [collections, brands] = await Promise.all([
    prisma.collection.findMany({
      where: {
        isActive: true, AND: liveWindow(new Date()), OR: [{ organizationId }, { organizationId: null }],
        items: { some: { product: { isActive: true, storeProducts: { some: { storeId: id, isActive: true, stock: { gt: 0 } } } } } },
      },
      select: { slug: true },
    }),
    prisma.brand.findMany({ where: { products: { some: soldAt(id) } }, select: { slug: true }, orderBy: { slug: "asc" } }),
  ]);
  return { collections: collections.map((c) => c.slug), brands: brands.map((b) => b.slug) };
}

export async function sitemap(prisma: PrismaClient): Promise<WebSitemap> {
  const sold: Prisma.ProductWhereInput = { isActive: true, isDraft: false, storeProducts: { some: { isActive: true, store: webStoreWhere() } } };
  const [categories, products, lists] = await Promise.all([
    prisma.category.findMany({
      where: { subcategories: { some: { products: { some: sold } } } },
      select: { slug: true, department: { select: { slug: true } } },
    }),
    prisma.product.findMany({ where: sold, select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    crawlerLists(prisma),
  ]);
  return {
    departments: [...new Set(categories.map((c) => c.department.slug))],
    categories: categories.map((c) => ({ slug: c.slug, department: c.department.slug })),
    products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
    ...lists,
  };
}
