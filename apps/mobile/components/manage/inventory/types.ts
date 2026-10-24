export type DiscountType = "FLAT" | "PERCENTAGE";

export interface StoreProductItem {
  id: string;
  storeId: string;
  productId: string;
  variantId: string;
  price: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  isActive: boolean;
  isFeatured: boolean;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountStart: string | null;
  discountEnd: string | null;
  memberPrice: string | null;
  offerBuyQty: number | null;
  offerGetQty: number | null;
  offerStart: string | null;
  offerEnd: string | null;
  store: { id: string; name: string };
  product: { id: string; name: string; imageUrl: string | null; images: string[]; organizationId: string | null; brand: { name: string } | null };
  variant: { id: string; name: string; imageUrl: string | null; mrp: string | null };
  pricing: { effectivePrice: number; originalPrice: number; discountActive: boolean; offer: { buy: number; get: number } | null };
}

export interface StockSummary {
  totals: { totalSKUs: number; inStock: number; lowStock: number; outOfStock: number };
}

export interface CatalogVariant {
  id: string;
  name: string;
  mrp: string | null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  images: string[];
  brand: { name: string } | null;
  subcategory: { name: string } | null;
  /** null = master catalog product; set = the organization's own */
  organizationId: string | null;
  variants: CatalogVariant[];
  /** Present only when the list was requested with includeStoreProducts */
  storeProducts?: { id: string; storeId: string; variantId: string }[];
}

export type CatalogFilter = "all" | "low" | "out" | "unlisted" | "featured";

export const FILTER_PARAMS: Record<CatalogFilter, Record<string, string>> = {
  all: {},
  low: { stockStatus: "low_stock" },
  out: { stockStatus: "out_of_stock" },
  unlisted: { isActive: "false" },
  featured: { isFeatured: "true" },
};
