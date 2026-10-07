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
