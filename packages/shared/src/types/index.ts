// ── API Response Envelope ─────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
}

// ── Paginated Response ────────────────────────────────
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ── Query Params ──────────────────────────────────────
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type ListParams = PaginationParams & SortParams;

// ── Auth ──────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
  iat: number;
  exp: number;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export type LoginResponse =
  | { requiresOrgSelection: false; accessToken: string; refreshToken: string }
  | { requiresOrgSelection: true; organizations: OrgSummary[]; temporaryToken: string };

// ── 3-Tier Taxonomy ──────────────────────────────────
export interface SubcategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  translations?: Record<string, { name?: string; description?: string }> | null;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  translations?: Record<string, { name?: string; description?: string }> | null;
  subcategories: SubcategoryNode[];
}

export interface DepartmentNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  translations?: Record<string, { name?: string; description?: string }> | null;
  categories: CategoryNode[];
}

// ── Brand Directory ──────────────────────────────────
export interface DirectoryBrand {
  id: string;
  name: string;
  imageUrl: string | null;
  themeColor: string | null;
  themeColorSecondary: string | null;
  productCount: number;
  /** For brands without a logo: their best-selling pack shot in this category at the store */
  coverImageUrl: string | null;
}

export interface DirectoryCategory {
  id: string;
  name: string;
  translations?: Record<string, { name?: string; description?: string }> | null;
  brands: DirectoryBrand[];
}

export interface DirectoryDepartment {
  id: string;
  name: string;
  translations?: Record<string, { name?: string; description?: string }> | null;
  categories: DirectoryCategory[];
}

// A store's brands by department → category (a brand appears under every category it has products in);
// `featured` = brands with a brand store (theme colour), `brandCount` = distinct brands in the store
export interface BrandDirectory {
  featured: DirectoryBrand[];
  departments: DirectoryDepartment[];
  brandCount: number;
}

// Admin brand list KPIs
export interface BrandSummary {
  total: number;
  brandStores: number;
  withoutLogo: number;
  withoutProducts: number;
  addedLast30d: number;
}

/** A KPI card's slice of the brand list; every summary count except the total */
export type BrandSegment = Exclude<keyof BrandSummary, "total">;

// Category browse: how many products a store lists in each subcategory under a node, and its top brands there
export interface CategoryFacets {
  subcategoryCounts: Record<string, number>;
  brands: { id: string; name: string; imageUrl: string | null; count: number }[];
}

// ── Promo agent ──
export interface PromoCopy {
  title: string;
  subtitle: string;
}

export interface PromoSummary {
  id: string;
  kind: "AI" | "MANUAL";
  /** Run by a brand campaign: it starts and ends with the campaign */
  fromBrand: boolean;
  brief: string;
  status: "DRAFTING" | "READY" | "LIVE" | "ENDED" | "FAILED" | "DISCARDED";
  autoLaunch: boolean;
  notify: boolean;
  title: string | null;
  /** The English banner (or the text-free art), once drawn */
  imageUrl: string | null;
  discountType: "FLAT" | "PERCENTAGE" | null;
  discountValue: number | null;
  productCount: number;
  startsAt: string | null;
  endsAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface CatalogDraftSummary {
  id: string;
  status: "QUEUED" | "PROCESSING" | "NEEDS_REVIEW" | "PUBLISHED" | "DUPLICATE" | "FAILED" | "DISCARDED";
  storeId: string;
  storeName: string;
  /** What the agent read off the pack, else the name the manager typed */
  name: string | null;
  variantName: string | null;
  thumbnailUrl: string;
  photoCount: number;
  mrp: number;
  sellingPrice: number;
  stock: number;
  reviewReasons: string[];
  error: string | null;
  productId: string | null;
  matchedExisting: boolean;
  createdByName: string;
  /** Estimated AI spend so far */
  costUsd: number;
  createdAt: string;
}

export interface CatalogDraftShot {
  index: number;
  original: string;
  /** The image used for the listing, once processed */
  processed: string | null;
  source: "openai" | "photoroom" | "plain" | null;
  verdict: "pass" | "minor_only" | "fail" | null;
  differences: string[];
  role: string | null;
}

export interface CatalogDraftLabel {
  name: string;
  brand: string | null;
  variantName: string;
  unitType: string;
  unitValue: number;
  barcode: string | null;
  printedMrp: number | null;
  foodType: "VEG" | "NON_VEG" | "VEGAN" | "EGG" | null;
  productType: string;
  ingredients: string | null;
  nutrition: { name: string; value: string }[];
  allergens: string[];
  fssaiLicense: string | null;
  manufacturerName: string | null;
  countryOfOrigin: string | null;
  shelfLifeDays: number | null;
  storageType: string | null;
  storageInstructions: string | null;
  usageInstructions: string | null;
  dangerWarnings: string | null;
  description: string;
  tags: string[];
  confidence: { name: string; size: string; brand: string };
  notes: string;
}

export interface CatalogDraftSize {
  id: string;
  name: string;
  mrp: number | null;
  /** Null when this store doesn't list the size */
  price: number | null;
  stock: number | null;
}

export interface CatalogDraftDetail extends CatalogDraftSummary {
  hintName: string | null;
  shots: CatalogDraftShot[];
  label: CatalogDraftLabel | null;
  brand: { id: string; name: string } | null;
  brandConfidence: string | null;
  subcategory: { id: string; path: string } | null;
  subcategoryConfidence: string | null;
  barcodeTaken: boolean;
  /** The published product's sizes and their listing in the draft's store */
  sizes: CatalogDraftSize[];
  usage: { step: string; model: string; inputTokens: number; outputTokens: number; usd: number }[];
}

export interface PromoProduct {
  productId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  subcategory: string | null;
  priceMin: number;
  priceMax: number;
  /** Prices after the promo's discount; null when the promo has no discount */
  promoPriceMin: number | null;
  promoPriceMax: number | null;
}

export interface PromoDetail extends PromoSummary {
  collectionId: string | null;
  assumptions: string[];
  log: { at: string; message: string }[];
  copy: Record<string, PromoCopy> | null;
  push: { title: string; body: string } | null;
  /** Banner per language ("en", "ta"), or { art } when the copy couldn't be set into the artwork */
  images: Record<string, string> | null;
  textInImage: boolean;
  products: PromoProduct[];
  /** What launch changes (READY) or changed (LIVE/ENDED) */
  priceChanges: { listings: number; stores: number; keptExisting: number } | null;
  pushSent: { recipients: number; at: string } | null;
  /** How the promotion was paid for: the plan's allowance, a bought top-up, a brand, or Martly itself */
  chargedFrom: "PLAN" | "TOPUP" | "BRAND" | "PLATFORM" | null;
  /** The owner uploaded the banner instead of having the AI paint it */
  uploadedImage: boolean;
  /** Free redrafts still available while the promo is READY */
  redraftsLeft: number;
  /** Manual promotions: where their banners lead and what the discount covers */
  actionType: string | null;
  actionTarget: string | null;
  launchAt: string | null;
  /** Its banner in the home carousel, once there is one (AI promotions get theirs at launch) */
  banner: PromoBanner | null;
}

/** A promotion's banner, with its last 30 days of results */
export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  textInImage: boolean;
  isActive: boolean;
  views: number;
  taps: number;
  ctr: number;
}
export * from "./home.js";
