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
}
