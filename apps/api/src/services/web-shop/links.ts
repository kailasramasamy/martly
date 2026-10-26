import type { PrismaClient } from "../../../generated/prisma/client.js";

const TTL_MS = 10 * 60_000;

/** Site paths for the things Home sections point at, from ids */
export interface LinkBook {
  /** A department, category or subcategory id */
  category(id: string): string | null;
  /** A category's slug, the value of list pages' `category` filter */
  categorySlug(id: string): string | null;
  /** A collection, narrowed to these aisles (subcategory ids) when given */
  collection(id: string, aisleIds?: string[]): string | null;
  brand(id: string): string | null;
  product(id: string): string | null;
  /** Aisle ids as the `aisle` query value of collection pages */
  aisleParam(ids: string[]): string | null;
}

type Taxonomy = { paths: Map<string, string>; categorySlugs: Map<string, string>; subSlugs: Map<string, string>; at: number };
let taxonomy: Taxonomy | null = null;
let brands: { slugs: Map<string, string>; at: number } | null = null;

// Departments, categories and aisles change rarely and number in the hundreds, so one copy serves every request
async function taxonomyPaths(prisma: PrismaClient) {
  if (taxonomy && Date.now() - taxonomy.at < TTL_MS) return taxonomy;
  const departments = await prisma.department.findMany({
    select: { id: true, slug: true, categories: { select: { id: true, slug: true, subcategories: { select: { id: true, slug: true } } } } },
  });
  const paths = new Map<string, string>();
  const categorySlugs = new Map<string, string>();
  const subSlugs = new Map<string, string>();
  for (const d of departments) {
    paths.set(d.id, `/c/${d.slug}`);
    for (const c of d.categories) {
      paths.set(c.id, `/c/${d.slug}/${c.slug}`);
      categorySlugs.set(c.id, c.slug);
      for (const s of c.subcategories) {
        paths.set(s.id, `/c/${d.slug}/${c.slug}?sub=${s.slug}`);
        subSlugs.set(s.id, s.slug);
      }
    }
  }
  taxonomy = { paths, categorySlugs, subSlugs, at: Date.now() };
  return taxonomy;
}

async function brandSlugs(prisma: PrismaClient) {
  if (brands && Date.now() - brands.at < TTL_MS) return brands.slugs;
  const rows = await prisma.brand.findMany({ select: { id: true, slug: true } });
  brands = { slugs: new Map(rows.map((b) => [b.id, b.slug])), at: Date.now() };
  return brands.slugs;
}

/** Everything a page of sections links to, looked up in a few queries; product ids are the only ones fetched per page */
export async function linkBook(prisma: PrismaClient, organizationId: string, productIds: string[]): Promise<LinkBook> {
  const [tax, brandSlug, collections, products] = await Promise.all([
    taxonomyPaths(prisma),
    brandSlugs(prisma),
    prisma.collection.findMany({ where: { OR: [{ organizationId }, { organizationId: null }] }, select: { id: true, slug: true } }),
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, slug: true } }) : [],
  ]);
  const collectionSlug = new Map(collections.map((c) => [c.id, c.slug]));
  const productSlug = new Map(products.map((p) => [p.id, p.slug]));
  const aisleParam = (ids: string[]) => ids.flatMap((id) => tax.subSlugs.get(id) ?? []).join(",") || null;
  return {
    category: (id) => tax.paths.get(id) ?? null,
    categorySlug: (id) => tax.categorySlugs.get(id) ?? null,
    collection: (id, aisleIds = []) => {
      const slug = collectionSlug.get(id);
      if (!slug) return null;
      const aisle = aisleParam(aisleIds);
      return aisle ? `/collections/${slug}?aisle=${aisle}` : `/collections/${slug}`;
    },
    brand: (id) => (brandSlug.has(id) ? `/brands/${brandSlug.get(id)}` : null),
    product: (id) => (productSlug.has(id) ? `/p/${productSlug.get(id)}` : null),
    aisleParam,
  };
}

/** Where a banner leads on the site, by its action */
export function bannerHref(links: LinkBook, banner: { actionType: string | null; actionTarget: string | null }) {
  const target = banner.actionTarget;
  if (!target) return null;
  switch (banner.actionType) {
    case "CATEGORY": return links.category(target);
    case "PRODUCT": return links.product(target);
    case "COLLECTION": return links.collection(target);
    case "SEARCH": return `/search?q=${encodeURIComponent(target)}`;
    case "BRAND": return links.brand(target);
    default: return null;
  }
}
