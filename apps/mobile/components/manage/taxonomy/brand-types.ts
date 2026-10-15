export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  themeColor: string | null;
  themeColorSecondary: string | null;
  popularity: number;
}

/** GET /brands (list) adds product counts; GET /brands/:id does not */
export interface BrandListItem extends BrandRecord {
  _count: { products: number };
}

export type BrandSegment = "all" | "brandStores" | "addedLast30d" | "withoutLogo" | "withoutProducts";

export interface BrandSummary {
  total: number;
  brandStores: number;
  addedLast30d: number;
  withoutLogo: number;
  withoutProducts: number;
}
