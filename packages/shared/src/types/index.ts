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

/** The brand featured in the shopper app's tab bar for a store */
export interface BrandSpotlight {
  id: string;
  name: string;
  imageUrl: string;
  /** Set when the brand paid for the tab slot: the slot reports its views and taps to the campaign */
  sponsored?: { bannerId: string };
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

// ── Cart builder ──
/** One store product offered for a list line, with the pack count that covers what was asked */
export interface CartBuilderCandidate<P = unknown> {
  storeProduct: P;
  /** The product's other sizes in stock, smallest first (not `storeProduct` itself) */
  sizes: P[];
  quantity: number;
  boughtBefore: boolean;
}

/** One line of a spoken or written list. MATCHED: the first candidate goes in the cart unless changed; PICK: the customer chooses */
export interface CartBuilderLine<P = unknown> {
  /** The words as the customer said or wrote them */
  text: string;
  /** The item, cleaned up ("Ponni rice") */
  item: string;
  confidence: "MATCHED" | "PICK" | "NOT_FOUND";
  /** Up to ten products, best first; empty when NOT_FOUND */
  candidates: CartBuilderCandidate<P>[];
}

export interface CartBuilderResult<P = unknown> {
  runId: string;
  lines: CartBuilderLine<P>[];
}

/**
 * The list-to-cart response, streamed as newline-delimited JSON so products show as they're found: the parsed
 * lines first, then each line's match as it completes (in any order), then the logged run. `error` ends it early.
 */
export type CartBuilderEvent<P = unknown> =
  | { type: "lines"; lines: { text: string; item: string }[] }
  | { type: "line"; index: number; line: CartBuilderLine<P> }
  | { type: "done"; runId: string; itemIds?: string[] }
  | { type: "error"; message: string };

export interface ShoppingListItem {
  id: string;
  text: string;
  createdAt: string;
}

/** A glossary entry: the ways shoppers say a thing, and the word the catalog uses for it */
export interface ListGlossaryTerm {
  id: string;
  searchTerm: string;
  note: string | null;
  isActive: boolean;
  phrases: { id: string; language: string; text: string }[];
  updatedAt: string;
}

/** A list the customer built a cart from before, to pick items from again */
export interface RecentList {
  /** The cart builder run it came from */
  id: string;
  createdAt: string;
  store: { name: string; translations?: Record<string, { name?: string }> | null };
  /** Each item in the customer's own words */
  items: string[];
}

/** What a spoken list item was heard as */
export interface SpeechTranscript {
  text: string;
}
type WalkNameTranslations = Record<string, { name?: string }> | null;

export interface StoreWalkDepartment {
  id: string;
  name: string;
  translations: WalkNameTranslations;
  imageUrl: string | null;
  /** A photo of the department's aisle in a shop, behind Walk the store's signs; null uses the app's own */
  aisleImageUrl: string | null;
  aisleCount: number;
  /** The shopper's due items in this department that aren't in the cart */
  dueCount: number;
}

/** One aisle of the walk: a category with stock at the store */
export interface StoreWalkStop {
  categoryId: string;
  name: string;
  translations: WalkNameTranslations;
  imageUrl: string | null;
  /** In-stock products in the aisle */
  stocked: number;
  /** Photos of the aisle's best sellers here, for its shelf */
  packs: string[];
  dueCount: number;
  /** The cart already holds something from this aisle */
  inCart: boolean;
}

export interface StoreWalkRoute<P = unknown> {
  departmentId: string;
  /** Departments with stock here, in shelf order */
  departments: StoreWalkDepartment[];
  /** The chosen department's aisles, in shelf order */
  stops: StoreWalkStop[];
  /** Aisles the cart's items come from, across departments */
  cartAisles: number;
  /** The chosen department's aisles with nothing in the cart, and the due items among them */
  uncovered: number;
  uncoveredDue: number;
  /** Due items not in the cart, across departments, most needed first (at most 8) */
  due: P[];
}

export interface StoreWalkAisle<P = unknown> {
  category: { id: string; name: string; translations: WalkNameTranslations; departmentId: string };
  stocked: number;
  /** The aisle's subcategories with stock here, in shelf order */
  subcategories: { id: string; name: string; translations: WalkNameTranslations; imageUrl: string | null; stocked: number }[];
  /** The brands on these shelves (the picked subcategory's, when one is), best sellers first */
  brands: { id: string; name: string; imageUrl: string | null; count: number }[];
  /** The shopper's due items in this aisle, in the size they buy */
  due: P[];
  /** The aisle's best sellers (or one subcategory's, when asked), due items left out */
  popular: P[];
  /** Running offers elsewhere in the department, for the display at the aisle's end (at most 3) */
  endcap: P[];
}

/** One line of a monthly list as the store sells it today; `listing` is null when the store no longer lists that size */
export interface MonthlyListItemView<P = unknown> {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  name: string;
  translations: WalkNameTranslations;
  variantName: string;
  imageUrl: string | null;
  /** The aisle (category) it sits in, for grouping */
  aisle: { id: string; name: string; translations: WalkNameTranslations } | null;
  listing: P | null;
  inStock: boolean;
  /** Today's price minus the price when last ordered; null when never ordered or unpriced */
  delta: number | null;
}

/** What changed since last month, for the shopper to settle before ordering */
export type MonthlyListChange<P = unknown> =
  | { kind: "OUT_OF_STOCK"; itemId: string; swap: P | null }
  | { kind: "BIGGER_PACK"; itemId: string; bigger: P; packs: number; saving: number; extra: number }
  | { kind: "LAPSED"; itemId: string; lastOrderedAt: string | null }
  | { kind: "NEW_USUAL"; product: P };

export interface MonthlyListView<P = unknown> {
  id: string;
  storeId: string;
  reminderDay: number;
  pushOn: boolean;
  whatsappOn: boolean;
  isActive: boolean;
  lastOrderedMonth: string | null;
  /** "2026-11": the month the list is for */
  month: string;
  /** The list is due this month and not yet ordered */
  due: boolean;
  items: MonthlyListItemView<P>[];
  /** Today's total for the in-stock lines */
  total: number;
  changes: MonthlyListChange<P>[];
}

/** The other language's text for an owner's words, keyed by language ({ ta: { text } }) */
export type VoiceTranslations = Partial<Record<string, { text: string }>>;

/** "Owner's pick" on a listing: why the owner vouches for it, in the words and language they used */
export interface OwnerPick {
  note: string;
  language: string;
  translations: VoiceTranslations | null;
  /** The owner's first name, for "Murugan, Harur Fresh Mart" */
  author: string;
}

/** A post from the store's owner, with the products it's about as the store sells them now */
export interface StorePostView<P = unknown> {
  id: string;
  kind: "FRESH_TODAY" | "NEW_IN_STORE" | "BACK_IN_STOCK";
  text: string;
  language: string;
  translations: VoiceTranslations | null;
  author: string;
  createdAt: string;
  expiresAt: string;
  products: P[];
}

/** What a list line can be swapped for, in stock today: its product's other sizes, and other brands in its subcategory closest in size */
export interface MonthlyListItemOptions<P = unknown> {
  sizes: P[];
  brands: P[];
}

/** Why a list can't be ordered in one tap; the app opens checkout instead */
export type MonthlyListQuoteBlock = "NOTHING_IN_STOCK" | "NO_ADDRESS" | "NOT_SERVICEABLE" | "NO_DELIVERY" | "BELOW_MINIMUM";

/** One-tap order for a list, paid on delivery: what it would be placed with, at today's prices */
export type MonthlyListQuote =
  | { ready: false; reason: MonthlyListQuoteBlock }
  | {
      ready: true;
      address: { id: string; label: string; address: string };
      delivery:
        | { kind: "EXPRESS"; etaMinutes: number | null }
        | { kind: "SLOT"; slotId: string; date: string; startTime: string; endTime: string };
      /** The lines asked about that the store can fill now, as the order takes them */
      lines: { storeProductId: string; quantity: number }[];
      itemsTotal: number;
      deliveryFee: number;
      toPay: number;
    };

export * from "./home.js";
export * from "./onboarding.js";
export * from "./towns.js";
export * from "./web.js";
export * from "./web-home.js";
export * from "./web-search.js";
export * from "./offers.js";
export * from "./price-review.js";
export * from "./stock-check.js";
export * from "./store-resolve.js";
export * from "./storefront.js";
export * from "./loose-staples.js";
export * from "./credits.js";
