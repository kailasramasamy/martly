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
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  images?: string[];
  brand: { id: string; name: string } | null;
  foodType: string | null;
  productType: string | null;
  regulatoryMarks: string[];
  certifications: string[];
  dangerWarnings: string | null;
  category?: { id: string; name: string } | null;
  variants?: Variant[];
  nutritionalInfo?: Record<string, string> | null;
  ingredients?: string | null;
  allergens?: string | null;
  storageInstructions?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  averageRating?: number;
  reviewCount?: number;
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

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  imageUrl: string | null;
  children: CategoryTreeNode[];
}

export interface CollectionSection {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  imageUrl: string | null;
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
  placement: "HERO_CAROUSEL" | "CATEGORY_STRIP" | "MID_PAGE" | "CATEGORY_TOP" | "CART_UPSELL" | "POPUP";
  actionType: "CATEGORY" | "PRODUCT" | "COLLECTION" | "SEARCH" | "URL" | "NONE";
  actionTarget: string | null;
}

export interface HomeFeed {
  collections: CollectionSection[];
  categories: CategoryTreeNode[];
  timeCategories: TimeCategorySection[];
  timePeriod: string;
  deals: StoreProduct[];
  buyAgain: StoreProduct[];
  banners: Banner[];
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
