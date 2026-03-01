export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORG_ADMIN: "ORG_ADMIN",
  STORE_MANAGER: "STORE_MANAGER",
  STAFF: "STAFF",
  CUSTOMER: "CUSTOMER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const StoreStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED",
} as const;
export type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus];

export const OrderStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY: "READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const UnitType = {
  KG: "KG",
  GRAM: "GRAM",
  LITER: "LITER",
  ML: "ML",
  PIECE: "PIECE",
  PACK: "PACK",
  DOZEN: "DOZEN",
  BUNDLE: "BUNDLE",
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const UnitTypeLabels: Record<UnitType, string> = {
  KG: "Kilogram",
  GRAM: "Gram",
  LITER: "Liter",
  ML: "Milliliter",
  PIECE: "Piece",
  PACK: "Pack",
  DOZEN: "Dozen",
  BUNDLE: "Bundle",
};

export const FoodType = {
  VEG: "VEG",
  NON_VEG: "NON_VEG",
  VEGAN: "VEGAN",
  EGG: "EGG",
} as const;
export type FoodType = (typeof FoodType)[keyof typeof FoodType];

export const FoodTypeLabels: Record<FoodType, string> = {
  VEG: "Vegetarian",
  NON_VEG: "Non-Vegetarian",
  VEGAN: "Vegan",
  EGG: "Egg",
};

export const ProductType = {
  GROCERY: "GROCERY",
  SNACKS: "SNACKS",
  BEVERAGES: "BEVERAGES",
  DAIRY: "DAIRY",
  FROZEN: "FROZEN",
  FRESH_PRODUCE: "FRESH_PRODUCE",
  BAKERY: "BAKERY",
  PERSONAL_CARE: "PERSONAL_CARE",
  HOUSEHOLD: "HOUSEHOLD",
  BABY_CARE: "BABY_CARE",
  PET_CARE: "PET_CARE",
  OTC_PHARMA: "OTC_PHARMA",
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const ProductTypeLabels: Record<ProductType, string> = {
  GROCERY: "Grocery",
  SNACKS: "Snacks",
  BEVERAGES: "Beverages",
  DAIRY: "Dairy",
  FROZEN: "Frozen",
  FRESH_PRODUCE: "Fresh Produce",
  BAKERY: "Bakery",
  PERSONAL_CARE: "Personal Care",
  HOUSEHOLD: "Household",
  BABY_CARE: "Baby Care",
  PET_CARE: "Pet Care",
  OTC_PHARMA: "OTC Pharma",
};

export const StorageType = {
  AMBIENT: "AMBIENT",
  REFRIGERATED: "REFRIGERATED",
  DEEP_CHILLED: "DEEP_CHILLED",
  FROZEN: "FROZEN",
  COOL_DRY: "COOL_DRY",
  HUMIDITY_CONTROLLED: "HUMIDITY_CONTROLLED",
} as const;
export type StorageType = (typeof StorageType)[keyof typeof StorageType];

export const StorageTypeLabels: Record<StorageType, string> = {
  AMBIENT: "Room Temperature",
  REFRIGERATED: "Refrigerated (2-8°C)",
  DEEP_CHILLED: "Deep Chilled (0-2°C)",
  FROZEN: "Frozen (-18°C)",
  COOL_DRY: "Cool & Dry",
  HUMIDITY_CONTROLLED: "Humidity Controlled",
};

export const RegulatoryMark = {
  FSSAI: "FSSAI",
  ISI: "ISI",
  AGMARK: "AGMARK",
  BIS: "BIS",
  ORGANIC_INDIA: "ORGANIC_INDIA",
  HALAL: "HALAL",
  KOSHER: "KOSHER",
  ECOMARK: "ECOMARK",
  FPO: "FPO",
} as const;
export type RegulatoryMark = (typeof RegulatoryMark)[keyof typeof RegulatoryMark];

export const FulfillmentType = {
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
} as const;
export type FulfillmentType = (typeof FulfillmentType)[keyof typeof FulfillmentType];

export const FulfillmentTypeLabels: Record<FulfillmentType, string> = {
  DELIVERY: "Home Delivery",
  PICKUP: "Store Pickup",
};

export const DiscountType = {
  FLAT: "FLAT",
  PERCENTAGE: "PERCENTAGE",
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const ReviewStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const DiscountTypeLabels: Record<DiscountType, string> = {
  FLAT: "Flat Amount",
  PERCENTAGE: "Percentage",
};

export const LoyaltyTransactionType = {
  EARN: "EARN",
  REDEEM: "REDEEM",
  REVERSAL: "REVERSAL",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type LoyaltyTransactionType = (typeof LoyaltyTransactionType)[keyof typeof LoyaltyTransactionType];

export const LoyaltyTransactionTypeLabels: Record<LoyaltyTransactionType, string> = {
  EARN: "Earned",
  REDEEM: "Redeemed",
  REVERSAL: "Reversal",
  ADJUSTMENT: "Adjustment",
};

export const TripStatus = {
  CREATED: "CREATED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

export const TripStatusLabels: Record<TripStatus, string> = {
  CREATED: "Created",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const BannerPlacement = {
  HERO_CAROUSEL: "HERO_CAROUSEL",
  CATEGORY_STRIP: "CATEGORY_STRIP",
  MID_PAGE: "MID_PAGE",
  CATEGORY_TOP: "CATEGORY_TOP",
  CART_UPSELL: "CART_UPSELL",
  POPUP: "POPUP",
} as const;
export type BannerPlacement = (typeof BannerPlacement)[keyof typeof BannerPlacement];

export const BannerPlacementLabels: Record<BannerPlacement, string> = {
  HERO_CAROUSEL: "Hero Carousel",
  CATEGORY_STRIP: "Category Strip",
  MID_PAGE: "Mid Page",
  CATEGORY_TOP: "Category Top",
  CART_UPSELL: "Cart Upsell",
  POPUP: "Popup",
};

export const BannerActionType = {
  CATEGORY: "CATEGORY",
  PRODUCT: "PRODUCT",
  COLLECTION: "COLLECTION",
  SEARCH: "SEARCH",
  URL: "URL",
  NONE: "NONE",
} as const;
export type BannerActionType = (typeof BannerActionType)[keyof typeof BannerActionType];

export const BannerActionTypeLabels: Record<BannerActionType, string> = {
  CATEGORY: "Category",
  PRODUCT: "Product",
  COLLECTION: "Collection",
  SEARCH: "Search",
  URL: "External URL",
  NONE: "No Action",
};

export const RegulatoryMarkLabels: Record<RegulatoryMark, string> = {
  FSSAI: "FSSAI",
  ISI: "ISI Mark",
  AGMARK: "AGMARK",
  BIS: "BIS Certification",
  ORGANIC_INDIA: "Organic India",
  HALAL: "Halal",
  KOSHER: "Kosher",
  ECOMARK: "Ecomark",
  FPO: "FPO Mark",
};

export const NotificationType = {
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  ORDER_PREPARING: "ORDER_PREPARING",
  ORDER_READY: "ORDER_READY",
  ORDER_OUT_FOR_DELIVERY: "ORDER_OUT_FOR_DELIVERY",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  WALLET_CREDITED: "WALLET_CREDITED",
  WALLET_DEBITED: "WALLET_DEBITED",
  LOYALTY_POINTS_EARNED: "LOYALTY_POINTS_EARNED",
  LOYALTY_POINTS_REDEEMED: "LOYALTY_POINTS_REDEEMED",
  PROMOTIONAL: "PROMOTIONAL",
  GENERAL: "GENERAL",
  WELCOME: "WELCOME",
  REVIEW_REQUEST: "REVIEW_REQUEST",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationTypeLabels: Record<NotificationType, string> = {
  ORDER_CONFIRMED: "Order Confirmed",
  ORDER_PREPARING: "Preparing Order",
  ORDER_READY: "Order Ready",
  ORDER_OUT_FOR_DELIVERY: "Out for Delivery",
  ORDER_DELIVERED: "Order Delivered",
  ORDER_CANCELLED: "Order Cancelled",
  WALLET_CREDITED: "Wallet Credited",
  WALLET_DEBITED: "Wallet Debited",
  LOYALTY_POINTS_EARNED: "Points Earned",
  LOYALTY_POINTS_REDEEMED: "Points Redeemed",
  PROMOTIONAL: "Promotional",
  GENERAL: "General",
  WELCOME: "Welcome",
  REVIEW_REQUEST: "Review Request",
};

export const CampaignStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  SENDING: "SENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const CampaignStatusLabels: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
};

export const AudienceType = {
  ALL_CUSTOMERS: "ALL_CUSTOMERS",
  STORE_CUSTOMERS: "STORE_CUSTOMERS",
  ORDERED_LAST_N_DAYS: "ORDERED_LAST_N_DAYS",
  NOT_ORDERED_N_DAYS: "NOT_ORDERED_N_DAYS",
  HIGH_VALUE_CUSTOMERS: "HIGH_VALUE_CUSTOMERS",
} as const;
export type AudienceType = (typeof AudienceType)[keyof typeof AudienceType];

export const AudienceTypeLabels: Record<AudienceType, string> = {
  ALL_CUSTOMERS: "All Customers",
  STORE_CUSTOMERS: "Store Customers",
  ORDERED_LAST_N_DAYS: "Ordered Recently",
  NOT_ORDERED_N_DAYS: "Inactive Customers",
  HIGH_VALUE_CUSTOMERS: "High Value",
};

export const ReferralStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  EXPIRED: "EXPIRED",
} as const;
export type ReferralStatus = (typeof ReferralStatus)[keyof typeof ReferralStatus];

export const ReferralStatusLabels: Record<ReferralStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};
