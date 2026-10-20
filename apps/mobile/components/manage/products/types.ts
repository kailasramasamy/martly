import type { VariantListing } from "@martly/shared/listing";
export interface BrandRef {
  id: string;
  name: string;
  imageUrl?: string | null;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unitType: string;
  unitValue: string | number;
  mrp: string | number | null;
  packType: string | null;
}

export interface ProductListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  images: string[];
  isActive: boolean;
  /** Created but not launched: shoppers can't see it yet */
  isDraft: boolean;
  organizationId: string | null;
  brand: BrandRef | null;
  subcategory: { id: string; name: string } | null;
  organization: { id: string; name: string } | null;
  variants: ProductVariant[];
  /** Present when requested with includeStoreProducts=true (scoped to the member's stores) */
  storeProducts?: VariantListing[];
}

export interface ProductDetail extends ProductListItem {
  subcategoryId: string | null;
  description: string | null;
  tags: string[];
  productType: string | null;
  foodType: string | null;
  hsnCode: string | null;
  gstPercent: string | number | null;
  fssaiLicense: string | null;
  mfgLicenseNo: string | null;
  manufacturerName: string | null;
  countryOfOrigin: string | null;
  regulatoryMarks: string[];
  certifications: string[];
  dangerWarnings: string | null;
  usageInstructions: string | null;
  ingredients: string | null;
  nutritionalInfo: unknown;
  allergens: string[];
  servingSize: string | null;
  shelfLifeDays: number | null;
  storageType: string | null;
  storageInstructions: string | null;
  translations: { ta?: { name?: string; description?: string } } | null;
}

export type CatalogFilter = "all" | "master" | "org";

export interface StoreMapping {
  id: string;
  storeId: string;
  variantId: string;
  price: string | number;
  stock: number;
  reservedStock: number;
  isActive: boolean;
  isFeatured: boolean;
  store: { id: string; name: string };
  variant: { id: string; name: string };
}
