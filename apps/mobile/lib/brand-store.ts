import type { DepartmentNode, StoreProduct, Translations } from "./types";

export interface BrandSection {
  id: string;
  name: string;
  imageUrl?: string | null;
  translations?: Translations | null;
  products: StoreProduct[];
  productCount: number;
}

export interface BrandCategory {
  id: string;
  name: string;
  imageUrl?: string | null;
  translations?: Translations | null;
  sections: BrandSection[];
  productCount: number;
}

const OTHER_ID = "__other__";

const countProducts = (listings: StoreProduct[]) => new Set(listings.map((l) => l.product.id)).size;

// The brand's own pack shot for a group (falls back to the catalog image), so tiles look like the brand
const coverImage = (listings: StoreProduct[], fallback?: string | null) =>
  listings.find((l) => l.product.imageUrl)?.product.imageUrl ?? fallback;

// Groups a brand's store listings into category → subcategory sections, biggest first.
// Listings without a known subcategory land in a trailing "More" category.
export function groupBrandProducts(listings: StoreProduct[], tree: DepartmentNode[]): BrandCategory[] {
  const bySub = new Map<string, StoreProduct[]>();
  for (const l of listings) {
    const key = l.product.subcategory?.id ?? OTHER_ID;
    bySub.set(key, [...(bySub.get(key) ?? []), l]);
  }

  const categories: BrandCategory[] = [];
  for (const cat of tree.flatMap((d) => d.categories)) {
    const sections = cat.subcategories
      .filter((s) => bySub.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, imageUrl: coverImage(bySub.get(s.id)!, s.imageUrl), translations: s.translations, products: bySub.get(s.id)!, productCount: countProducts(bySub.get(s.id)!) }));
    sections.forEach((s) => bySub.delete(s.id));
    if (sections.length) {
      categories.push({ id: cat.id, name: cat.name, imageUrl: coverImage(sections.flatMap((s) => s.products), cat.imageUrl), translations: cat.translations, sections, productCount: sections.reduce((n, s) => n + s.productCount, 0) });
    }
  }

  categories.sort((a, b) => b.productCount - a.productCount);
  categories.forEach((c) => c.sections.sort((a, b) => b.productCount - a.productCount));

  const rest = [...bySub.values()].flat();
  if (rest.length) {
    const count = countProducts(rest);
    categories.push({ id: OTHER_ID, name: "More", productCount: count, sections: [{ id: OTHER_ID, name: "More", products: rest, productCount: count }] });
  }
  return categories;
}

// One rail on the brand home: a subcategory, or a pool of thin ones (no section)
export interface BrandRail {
  key: string;
  section?: BrandSection;
  products: StoreProduct[];
  productCount: number;
}

// A category's rails on the brand home; `category` is null for the closing pool of small categories
export interface BrandBlock {
  key: string;
  category: BrandCategory | null;
  rails: BrandRail[];
}

const MIN_RAIL = 3;

const pool = (key: string, products: StoreProduct[]): BrandRail => ({ key, products, productCount: countProducts(products) });

// Brand home layout, so no row is a lone card: subcategories with enough products get their own rail, thin ones
// share a "More in <category>" rail, and categories too small for a rail share a closing "More from <brand>" one
export function brandHomeBlocks(categories: BrandCategory[]): BrandBlock[] {
  const blocks: BrandBlock[] = [];
  const leftovers: StoreProduct[] = [];
  for (const category of categories) {
    if (category.productCount < MIN_RAIL) {
      leftovers.push(...category.sections.flatMap((s) => s.products));
      continue;
    }
    const rails: BrandRail[] = category.sections.filter((s) => s.productCount >= MIN_RAIL)
      .map((s) => ({ key: s.id, section: s, products: s.products, productCount: s.productCount }));
    const thin = category.sections.filter((s) => s.productCount < MIN_RAIL).flatMap((s) => s.products);
    if (thin.length) rails.push(pool(`${category.id}:more`, thin));
    blocks.push({ key: category.id, category, rails });
  }
  if (leftovers.length) blocks.push({ key: OTHER_ID, category: null, rails: [pool(OTHER_ID, leftovers)] });
  return blocks;
}

// Matches every word of the query against the product name (English and translations) and its subcategory
export function searchBrandListings(listings: StoreProduct[], query: string): StoreProduct[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return listings.filter(({ product }) => {
    const names = [product.name, product.subcategory?.name, ...Object.values(product.translations ?? {}).map((t) => t.name)];
    const haystack = names.filter(Boolean).join(" ").toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}
