import type { HeroTileLayout } from "@martly/shared/constants";
import type { CampaignTile, HomeTheme } from "@martly/shared/types";
import type { PaginatedResponse } from "@martly/shared/types";

export interface Store {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryRadius?: number;
  distance?: number;
  minOrderAmount?: number | null;
  freeDeliveryThreshold?: number | null;
  baseDeliveryFee?: number | null;
  subscriptionEnabled?: boolean;
  imageUrl?: string | null;
  deliversToYou?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number;
  expressEtaMinutes?: number | null;
  operatingStart?: string | null;
  operatingEnd?: string | null;
  logoUrl?: string | null;
  promoImages?: string[];
  tagline?: string | null;
  offerText?: string | null;
  brandColor?: string | null;
  highlights?: string[];
  translations?: Record<string, { tagline?: string; offerText?: string }> | null;
  /** Items on offer right now and the biggest saving among them */
  deals?: { count: number; maxPercent: number } | null;
  /** Scheduled delivery slots still open for booking, soonest first (IST date, HH:MM times) */
  slots?: { date: string; startTime: string; endTime: string; orderBy: string; fewLeft: boolean }[];
  /** Road distance and time from the shopper, when known */
  drive?: { km: number; minutes: number } | null;
  /** Live home hero banners for this store (3:2), its own first */
  banners?: ({ id: string; imageUrl: string } & Pick<Banner, "actionType" | "actionTarget">)[];
}

export interface Variant {
  id: string;
  name: string;
  unitType: string;
  unitValue: string;
  mrp: number | null;
  imageUrl: string | null;
}

export interface Pricing {
  effectivePrice: number;
  originalPrice: number;
  discountType: string | null;
  discountValue: number | null;
  discountActive: boolean;
  savingsAmount: number;
  savingsPercent: number;
  memberPrice: number | null;
  memberSavingsAmount: number | null;
}

export interface StoreProduct {
  id: string;
  price: number;
  stock: number;
  reservedStock: number;
  availableStock: number;
  variantId: string;
  variant: Variant;
  pricing?: Pricing;
  product: Product;
  /** Set on a paid placement; its banner counts the views and taps */
  sponsored?: { bannerId: string };
}

export interface Translations {
  [lang: string]: { name?: string; description?: string };
}

export interface CollectionTranslations {
  [lang: string]: { title?: string; subtitle?: string };
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  images?: string[];
  brand: { id: string; name: string; imageUrl?: string | null; themeColor?: string | null; themeColorSecondary?: string | null } | null;
  foodType: string | null;
  productType: string | null;
  tags?: string[];
  regulatoryMarks: string[];
  certifications: string[];
  dangerWarnings: string | null;
  subcategory?: { id: string; name: string; category?: { id: string; name: string; department?: { id: string; name: string } } } | null;
  variants?: Variant[];
  nutritionalInfo?: Record<string, string> | null;
  ingredients?: string | null;
  allergens?: string | null;
  storageInstructions?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  averageRating?: number;
  // Top seller at this store over the last 30 days (search and listing responses)
  isBestseller?: boolean;
  reviewCount?: number;
  translations?: Translations | null;
}

export interface UserAddress {
  id: string;
  userId: string;
  label: string;
  placeName?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  _count?: { products: number };
}

export interface SubcategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  translations?: Translations | null;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  translations?: Translations | null;
  subcategories: SubcategoryNode[];
}

export interface DepartmentNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  translations?: Translations | null;
  categories: CategoryNode[];
}

export interface CollectionSection {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  imageUrl: string | null;
  kind: CollectionKind;
  translations: CollectionTranslations | null;
  products: StoreProduct[];
}

export interface TimeCategorySection {
  id: string;
  name: string;
  slug: string;
  products: StoreProduct[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  imageUrls: Record<string, string> | null;
  textInImage: boolean;
  placement: "HERO_CAROUSEL" | "CATEGORY_STRIP" | "MID_PAGE" | "CATEGORY_TOP" | "CART_UPSELL" | "POPUP" | "HOME_POSTER" | "SPONSORED_PRODUCT";
  actionType: "CATEGORY" | "PRODUCT" | "COLLECTION" | "SEARCH" | "URL" | "BRAND" | "NONE";
  actionTarget: string | null;
  sponsorType?: "STORE" | "BRAND" | "PLATFORM";
  brandId?: string | null;
}

export interface RecipeSummary {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  difficulty: string | null;
  cuisineType: string | null;
  dietType: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  translations: Translations | null;
  ingredientCount: number;
  availableCount: number;
  estimatedTotal: number;
}

export interface RecipeIngredient {
  id: string;
  displayQty: string;
  note: string | null;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    foodType: string | null;
  };
  storeProduct: StoreProduct | null;
  available: boolean;
}

export interface RecipeDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  instructions: string[];
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  difficulty: string | null;
  cuisineType: string | null;
  dietType: string | null;
  translations: Translations | null;
  items: RecipeIngredient[];
}

export interface FestiveAisle {
  id: string;
  name: string;
  imageUrl: string | null;
  translations: Translations | null;
}

export interface FestiveTile {
  id: string;
  title: string;
  translations: CollectionTranslations | null;
  imageUrl: string;
  /** The tile's aisles this store has in stock, in the tile's order */
  subcategories: FestiveAisle[];
}

export interface FestiveHero {
  id: string;
  title: string;
  translations: { [lang: string]: { title?: string; kicker?: string; subtitle?: string } } | null;
  /** Small line above the headline and the line under it, set over the silhouette strip */
  kicker: string | null;
  subtitle: string | null;
  /** The tone-on-tone silhouette strip drawn under the search bar */
  imageUrl: string;
  /** background is the solid festival colour behind the whole block; title is its text colour; dark means light text */
  theme: HomeTheme;
  tiles: FestiveTile[];
  /** FEATURE: five tiles, the first tall beside a 2x2 block; absent on older API responses, which mean GRID */
  tileLayout?: HeroTileLayout;
}

export interface HomeFeed {
  collections: CollectionSection[];
  departments: DepartmentNode[];
  timeCategories: TimeCategorySection[];
  timePeriod: string;
  deals: StoreProduct[];
  buyAgain: StoreProduct[];
  banners: Banner[];
  recipes: RecipeSummary[];
  festiveHero: FestiveHero | null;
}

export interface ReviewImage {
  id: string;
  reviewId: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ReviewReply {
  id: string;
  reviewId: string;
  userId: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerified: boolean;
  status: string;
  createdAt: string;
  user: { id: string; name: string };
  images?: ReviewImage[];
  reply?: ReviewReply | null;
}

export interface StoreRating {
  id: string;
  userId: string;
  orderId: string;
  storeId: string;
  overallRating: number;
  deliveryRating: number | null;
  packagingRating: number | null;
  comment: string | null;
  createdAt: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<number, number>;
}

export interface CouponValidation {
  valid: boolean;
  discount: number;
  code: string;
  description: string | null;
}

export interface DeliveryZoneInfo {
  deliveryFee: number;
  estimatedMinutes: number;
}

export type FulfillmentType = "DELIVERY" | "PICKUP";

export interface DeliveryLookupResult {
  serviceable: boolean;
  distance?: number;
  deliveryFee?: number;
  estimatedMinutes?: number;
  reason?: string;
  pickupAvailable?: boolean;
  storeName?: string;
  storeAddress?: string;
}

export interface OrderStatusLog {
  id: string;
  orderId: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface LoyaltyConfig {
  isEnabled: boolean;
  earnRate: number;
  minRedeemPoints: number;
  maxRedeemPercentage: number;
}

export interface LoyaltyTransaction {
  id: string;
  type: "EARN" | "REDEEM" | "REVERSAL" | "ADJUSTMENT";
  points: number;
  balanceAfter: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface LoyaltyData {
  config: LoyaltyConfig | null;
  balance: { points: number; totalEarned: number; totalRedeemed: number };
  transactions: LoyaltyTransaction[];
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  imageUrl: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface ReferralItem {
  id: string;
  refereeName: string;
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  referrerReward: number;
  refereeReward: number;
  completedAt: string | null;
  createdAt: string;
}

export interface ReferralInfo {
  referralCode: string;
  stats: {
    totalReferrals: number;
    completedReferrals: number;
    totalEarned: number;
  };
  referrals: ReferralItem[];
  appliedReferral: {
    referrerName: string;
    status: string;
    refereeReward: number;
  } | null;
}

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  freeDelivery: boolean;
  loyaltyMultiplier: number;
  isActive: boolean;
  sortOrder: number;
}

export interface UserMembership {
  id: string;
  userId: string;
  planId: string;
  organizationId: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  startDate: string;
  endDate: string;
  pricePaid: number;
  plan: MembershipPlan;
}

export interface MembershipUpgradeOption {
  plan: MembershipPlan;
  credit: number;
  upgradeCharge: number;
  isFree: boolean;
}

export interface MembershipStatus {
  isMember: boolean;
  membership: {
    planName: string;
    endDate: string;
    freeDelivery: boolean;
    loyaltyMultiplier: number;
  } | null;
}

export interface SubscriptionItem {
  id: string;
  storeProductId: string;
  quantity: number;
  storeProduct: {
    id: string;
    price: number;
    product: { id: string; name: string; imageUrl: string | null };
    variant: { id: string; name: string; unitType: string; unitValue: string; mrp: number | null };
  };
  pricing?: Pricing;
}

export interface Subscription {
  id: string;
  userId: string;
  storeId: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  frequency: "DAILY" | "ALTERNATE_DAYS" | "SPECIFIC_DAYS" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  selectedDays: number[];
  deliveryAddress: string;
  nextDeliveryDate: string;
  cutoffTime: string;
  pausedUntil: string | null;
  autoPayWithWallet: boolean;
  createdAt: string;
  items: SubscriptionItem[];
  store?: { id: string; name: string };
  _count?: { items: number };
}

export interface BasketItem {
  storeProductId: string;
  quantity: number;
  source: "subscription" | "addon";
  subscriptionId?: string;
  product: { id: string; name: string; imageUrl: string | null };
  variant: { id: string; name: string; unitType: string; unitValue: string };
  pricing: Pricing;
  isOverridden?: boolean;
  defaultQuantity?: number;
}

export interface TomorrowsBasket {
  deliveryDate: string;
  cutoffTime: string;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  items: BasketItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  walletBalance: number;
  hasActiveSubscriptions: boolean;
}

export interface SearchFacets {
  tags: { tag: string; count: number; imageUrl: string | null }[];
  // label is the name minus the searched words ("Detergent Powder" → "Powder") for the tab row
  subcategories: { id: string; name: string; label: string; count: number; imageUrl: string | null }[];
  brands: { id: string; name: string; count: number; imageUrl: string | null }[];
  sizes: { label: string; count: number }[];
  offerCount: number;
}

export interface SearchMeta {
  strategy: string;
  correctedQuery?: string;
  expandedTerms?: string[];
}

export type CollectionKind = "STANDARD" | "OCCASION" | "SEASON";

export interface LandingCollection {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  imageUrl: string | null;
  kind: CollectionKind;
  translations: CollectionTranslations | null;
  imageUrls: Record<string, string> | null;
  textInImage: boolean;
  subcategories: { id: string; name: string; translations: Translations | null }[];
  products: StoreProduct[];
}

export interface SearchLanding {
  trending: string[];
  categories: { id: string; name: string; imageUrl: string | null; translations?: Record<string, { name?: string; description?: string }> | null }[];
  occasions: LandingCollection[];
  timePicks: { period: "morning" | "afternoon" | "evening" | "night"; title: string; products: StoreProduct[] };
  reorder: { dueCount: number; products: StoreProduct[] };
}

export interface SearchSuggestion {
  text: string;
  kind: "query" | "category" | "brand";
  imageUrl: string | null;
}

export interface SearchSuggestions {
  suggestions: SearchSuggestion[];
  correctedQuery?: string;
}

export interface CollectionHeader {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  imageUrls: Record<string, string> | null;
  textInImage: boolean;
  translations: CollectionTranslations | null;
  endsAt: string | null;
  /** Present when the collection is a campaign on Home: the card's cut-out art, colours and offer, so its screen matches */
  campaign: { imageUrl: string | null; theme: { background: string; title: string; dark: boolean }; offerLabel: string | null } | null;
  /** The collection's aisles in stock at the store (first page only), for filter chips; null on later pages */
  aisles: CampaignTile[] | null;
}

export interface CollectionProductsResponse extends PaginatedResponse<StoreProduct> {
  collection: CollectionHeader;
}

export interface ReturnRequestData {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "EXPIRED";
  remedy: "REFUND" | "REPLACE" | null;
  method: "KEEP" | "NEXT_ORDER" | "AT_STORE" | null;
  reason: string;
  requestedAmount: string;
  approvedAmount: string | null;
  adminNote: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  store?: { name: string; address: string | null; phone: string | null };
  items?: { orderItemId: string; quantity: number }[];
}

export interface ReturnLineSummary {
  quantity: number;
  orderItem: {
    unitPrice?: string;
    product: { name: string; imageUrl?: string | null; images?: string[] };
    variant?: { name: string; imageUrl?: string | null } | null;
  };
}

export interface ReturnLinesGroup {
  id: string;
  orderId: string;
  reason?: string;
  items: ReturnLineSummary[];
}
