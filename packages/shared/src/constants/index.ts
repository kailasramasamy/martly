export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORG_ADMIN: "ORG_ADMIN",
  STORE_MANAGER: "STORE_MANAGER",
  STAFF: "STAFF",
  RIDER: "RIDER",
  CUSTOMER: "CUSTOMER",
  BRAND_PARTNER: "BRAND_PARTNER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserRoleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Owner",
  STORE_MANAGER: "Store Manager",
  STAFF: "Staff",
  RIDER: "Rider",
  CUSTOMER: "Customer",
  BRAND_PARTNER: "Brand partner",
};

// Staff capabilities (mirrors Prisma Permission). Roles grant a preset; owners grant add-ons per member.
export const Permission = {
  ORDERS_VIEW: "ORDERS_VIEW",
  ORDERS_PROCESS: "ORDERS_PROCESS",
  ORDERS_DISPATCH: "ORDERS_DISPATCH",
  ORDERS_CANCEL: "ORDERS_CANCEL",
  DELIVERY_DELIVER: "DELIVERY_DELIVER",
  RIDERS_MANAGE: "RIDERS_MANAGE",
  CATALOG_PRODUCTS: "CATALOG_PRODUCTS",
  CATALOG_BRANDS: "CATALOG_BRANDS",
  CATALOG_COLLECTIONS: "CATALOG_COLLECTIONS",
  LISTING_AVAILABILITY: "LISTING_AVAILABILITY",
  LISTING_MANAGE: "LISTING_MANAGE",
  LISTING_PRICES: "LISTING_PRICES",
  STOCK_VIEW: "STOCK_VIEW",
  STOCK_RECEIVE: "STOCK_RECEIVE",
  STOCK_COUNT: "STOCK_COUNT",
  STOCK_ADJUST: "STOCK_ADJUST",
  STOCK_APPROVE: "STOCK_APPROVE",
  RETURNS_HANDLE: "RETURNS_HANDLE",
  SUPPORT_HANDLE: "SUPPORT_HANDLE",
  REFUNDS_ISSUE: "REFUNDS_ISSUE",
  MARKETING_MANAGE: "MARKETING_MANAGE",
  DELIVERY_CONFIG: "DELIVERY_CONFIG",
  STORE_SETTINGS: "STORE_SETTINGS",
  TEAM_MANAGE: "TEAM_MANAGE",
  REPORTS_VIEW: "REPORTS_VIEW",
  FINANCE_MANAGE: "FINANCE_MANAGE",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

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
  PLANNED: "PLANNED",
  CREATED: "CREATED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

/** How a cash-on-delivery order was paid at the door (mirrors Prisma CodCollectionMode) */
export const CodCollectionMode = { CASH: "CASH", UPI: "UPI" } as const;
export type CodCollectionMode = (typeof CodCollectionMode)[keyof typeof CodCollectionMode];

/** Why a rider couldn't hand an order over (mirrors Prisma DeliveryFailureReason) */
export const DeliveryFailureReason = {
  CUSTOMER_UNAVAILABLE: "CUSTOMER_UNAVAILABLE",
  WRONG_ADDRESS: "WRONG_ADDRESS",
  CUSTOMER_REFUSED: "CUSTOMER_REFUSED",
  PAYMENT_ISSUE: "PAYMENT_ISSUE",
  OTHER: "OTHER",
} as const;
export type DeliveryFailureReason = (typeof DeliveryFailureReason)[keyof typeof DeliveryFailureReason];

export const DELIVERY_FAILURE_LABELS: Record<DeliveryFailureReason, string> = {
  CUSTOMER_UNAVAILABLE: "Customer not available",
  WRONG_ADDRESS: "Wrong or incomplete address",
  CUSTOMER_REFUSED: "Customer refused the order",
  PAYMENT_ISSUE: "Couldn't collect payment",
  OTHER: "Other",
};

/** Which batch a trip belongs to: a delivery slot, or express orders sent as they're packed */
export const TripWave = { SLOT: "SLOT", EXPRESS: "EXPRESS" } as const;
export type TripWave = (typeof TripWave)[keyof typeof TripWave];

export const TripStatusLabels: Record<TripStatus, string> = {
  PLANNED: "Planned",
  CREATED: "Created",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const BannerPlacement = {
  HERO_CAROUSEL: "HERO_CAROUSEL",
  CATEGORY_TOP: "CATEGORY_TOP",
  HOME_POSTER: "HOME_POSTER",
  SPONSORED_PRODUCT: "SPONSORED_PRODUCT",
  BRAND_TAB: "BRAND_TAB",
} as const;
export type BannerPlacement = (typeof BannerPlacement)[keyof typeof BannerPlacement];

export const CollectionKind = {
  STANDARD: "STANDARD",
  OCCASION: "OCCASION",
  SEASON: "SEASON",
  PROMO: "PROMO",
  STORE_SPECIAL: "STORE_SPECIAL",
} as const;
export type CollectionKind = (typeof CollectionKind)[keyof typeof CollectionKind];

export const CollectionKindLabels: Record<CollectionKind, string> = {
  STANDARD: "Standard",
  OCCASION: "Occasion / Festival",
  SEASON: "Season",
  PROMO: "Promo",
  STORE_SPECIAL: "Store special (made in-store)",
};

// Kinds an admin can pick by hand; PROMO collections are only made by the promo agent
export const EDITABLE_COLLECTION_KINDS = ["STANDARD", "OCCASION", "SEASON", "STORE_SPECIAL"] as const;

export const PromoStatus = {
  DRAFTING: "DRAFTING",
  READY: "READY",
  LIVE: "LIVE",
  ENDED: "ENDED",
  FAILED: "FAILED",
  DISCARDED: "DISCARDED",
} as const;
export type PromoStatus = (typeof PromoStatus)[keyof typeof PromoStatus];

export const CatalogDraftStatus = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  PUBLISHED: "PUBLISHED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  DISCARDED: "DISCARDED",
} as const;
export type CatalogDraftStatus = (typeof CatalogDraftStatus)[keyof typeof CatalogDraftStatus];

export const CurationSource = {
  MANUAL: "MANUAL",
  AGENT: "AGENT",
} as const;
export type CurationSource = (typeof CurationSource)[keyof typeof CurationSource];

// Festival calendar regions: "ALL" is pan-India, the rest are state codes
export const FESTIVAL_REGIONS = {
  ALL: "All India",
  TN: "Tamil Nadu",
  KA: "Karnataka",
  KL: "Kerala",
  AP: "Andhra Pradesh",
  TS: "Telangana",
  MH: "Maharashtra",
  GJ: "Gujarat",
  WB: "West Bengal",
  PB: "Punjab",
  DL: "Delhi",
  UP: "Uttar Pradesh",
} as const;
export type FestivalRegion = keyof typeof FESTIVAL_REGIONS;

// Languages the list glossary holds phrases for (catalog translations use SUPPORTED_LANGUAGES)
export const GLOSSARY_LANGUAGES = {
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
  te: "Telugu",
  hi: "Hindi",
} as const;
export type GlossaryLanguage = keyof typeof GLOSSARY_LANGUAGES;

// The language shoppers speak in each festival region, so a store's lists get that language's glossary phrases;
// regions without one get every language
export const REGION_LANGUAGES: Partial<Record<FestivalRegion, GlossaryLanguage>> = {
  TN: "ta",
  KA: "kn",
  KL: "ml",
  AP: "te",
  TS: "te",
  DL: "hi",
  UP: "hi",
};

// Longest single spoken item sent for transcription; a list item takes 2-3 seconds
export const SPEECH_MAX_SECONDS = 15;

export const BannerPlacementLabels: Record<BannerPlacement, string> = {
  HERO_CAROUSEL: "Hero Carousel",
  CATEGORY_TOP: "Category Top",
  HOME_POSTER: "Home brand poster",
  SPONSORED_PRODUCT: "Sponsored product",
  BRAND_TAB: "Bottom-bar brand tab",
};

export const BannerActionType = {
  BRAND: "BRAND",
  CATEGORY: "CATEGORY",
  PRODUCT: "PRODUCT",
  COLLECTION: "COLLECTION",
  SEARCH: "SEARCH",
  URL: "URL",
  NONE: "NONE",
} as const;
export type BannerActionType = (typeof BannerActionType)[keyof typeof BannerActionType];

export const BannerActionTypeLabels: Record<BannerActionType, string> = {
  BRAND: "Brand page",
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

export const TicketStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketStatusLabels: Record<TicketStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TicketPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketPriorityLabels: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const ReturnRequestStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;
export type ReturnRequestStatus = (typeof ReturnRequestStatus)[keyof typeof ReturnRequestStatus];

export const ReturnRequestStatusLabels: Record<ReturnRequestStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  APPROVED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

// What the customer gets for an approved return (mirrors Prisma ReturnRemedy)
export const ReturnRemedy = {
  REFUND: "REFUND",
  REPLACE: "REPLACE",
} as const;
export type ReturnRemedy = (typeof ReturnRemedy)[keyof typeof ReturnRemedy];

export const ReturnRemedyLabels: Record<ReturnRemedy, string> = {
  REFUND: "Refund to wallet",
  REPLACE: "Replace with next order",
};

// How a returned item gets back to the store (mirrors Prisma ReturnMethod)
export const ReturnMethod = {
  KEEP: "KEEP",
  NEXT_ORDER: "NEXT_ORDER",
  AT_STORE: "AT_STORE",
} as const;
export type ReturnMethod = (typeof ReturnMethod)[keyof typeof ReturnMethod];

export const ReturnMethodLabels: Record<ReturnMethod, string> = {
  KEEP: "Customer keeps it",
  NEXT_ORDER: "Collect with next order",
  AT_STORE: "Drop at store",
};

// Why an item was handed back at the door (mirrors Prisma RefuseReason)
export const RefuseReason = {
  DAMAGED: "DAMAGED",
  EXPIRED: "EXPIRED",
  WRONG_ITEM: "WRONG_ITEM",
  NOT_WANTED: "NOT_WANTED",
} as const;
export type RefuseReason = (typeof RefuseReason)[keyof typeof RefuseReason];

export const RefuseReasonLabels: Record<RefuseReason, string> = {
  DAMAGED: "Damaged",
  EXPIRED: "Expired or stale",
  WRONG_ITEM: "Wrong item",
  NOT_WANTED: "Didn't want it",
};

export const MembershipDuration = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  ANNUAL: "ANNUAL",
} as const;
export type MembershipDuration = (typeof MembershipDuration)[keyof typeof MembershipDuration];

export const MembershipDurationLabels: Record<MembershipDuration, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

export const MembershipStatus = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const MembershipStatusLabels: Record<MembershipStatus, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const RETURN_REASONS = [
  "Damaged/broken item",
  "Wrong item received",
  "Item expired/stale",
  "Quality not as expected",
  "Missing items",
  "Other",
] as const;

export const RETURN_WINDOW_HOURS = 48;

/** Days the rider has to collect a returned item with the customer's next order before it switches to a store drop */
export const RETURN_COLLECT_DAYS = 7;

/** Days after approval before an item that never came back expires the return, and an unsent replacement becomes a refund */
export const RETURN_EXPIRY_DAYS = 14;

/** How long each kind of pending work may wait before Today flags it and owners get an escalation; null never escalates */
export const ATTENTION_STALE_MINUTES = {
  returns_review: 4 * 60,
  returns_drop: null,
  ready_unassigned: 15,
  counts_approve: 24 * 60,
  recounts: 24 * 60,
  reviews: 48 * 60,
  tickets: 4 * 60,
  catalog_drafts: 48 * 60,
} as const;
export type AttentionKey = keyof typeof ATTENTION_STALE_MINUTES;

/** Reasons where the item is worthless to the store, so the customer keeps it by default */
export const RETURN_KEEP_REASONS: readonly string[] = ["Damaged/broken item", "Item expired/stale", "Missing items", "Quality not as expected"];

export const SubscriptionStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SubscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
};

/** What an owner's post to shoppers is about */
export const StorePostKind = {
  FRESH_TODAY: "FRESH_TODAY",
  NEW_IN_STORE: "NEW_IN_STORE",
  BACK_IN_STOCK: "BACK_IN_STOCK",
} as const;
export type StorePostKind = (typeof StorePostKind)[keyof typeof StorePostKind];

/** An aisle shows at most this many owner's picks, so each one means something */
export const MAX_PICKS_PER_AISLE = 3;

export const SubscriptionFrequency = {
  DAILY: "DAILY",
  ALTERNATE_DAYS: "ALTERNATE_DAYS",
  SPECIFIC_DAYS: "SPECIFIC_DAYS",
  WEEKLY: "WEEKLY",
  BIWEEKLY: "BIWEEKLY",
  MONTHLY: "MONTHLY",
} as const;
export type SubscriptionFrequency = (typeof SubscriptionFrequency)[keyof typeof SubscriptionFrequency];

export const SubscriptionFrequencyLabels: Record<SubscriptionFrequency, string> = {
  DAILY: "Daily",
  ALTERNATE_DAYS: "Alternate Days",
  SPECIFIC_DAYS: "Specific Days",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 Weeks",
  MONTHLY: "Monthly",
};

export const SubscriptionDeliveryMode = {
  DEDICATED: "DEDICATED",
  SLOT_BASED: "SLOT_BASED",
} as const;
export type SubscriptionDeliveryMode = (typeof SubscriptionDeliveryMode)[keyof typeof SubscriptionDeliveryMode];

export const SubscriptionDeliveryModeLabels: Record<SubscriptionDeliveryMode, string> = {
  DEDICATED: "Dedicated Window",
  SLOT_BASED: "Regular Slots",
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const Difficulty = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const DifficultyLabels: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const SUPPORTED_LANGUAGES = {
  ta: "Tamil (தமிழ்)",
  kn: "Kannada (ಕನ್ನಡ)",
  te: "Telugu (తెలుగు)",
  hi: "Hindi (हिन्दी)",
} as const;
export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

export const SearchSortBy = {
  RELEVANCE: "relevance",
  PRICE_ASC: "price_asc",
  PRICE_DESC: "price_desc",
  DISCOUNT: "discount",
} as const;
export type SearchSortBy = (typeof SearchSortBy)[keyof typeof SearchSortBy];

// What a shopper did with a search result (mirrors Prisma SearchEventType)
export const SearchEventType = {
  CLICK: "CLICK",
  ADD_TO_CART: "ADD_TO_CART",
} as const;
export type SearchEventType = (typeof SearchEventType)[keyof typeof SearchEventType];

// Where a list-to-cart request came from (mirrors Prisma CartBuilderSource)
export const CartBuilderSource = {
  VOICE: "VOICE",
  LIST: "LIST",
  PHOTO: "PHOTO",
  WHATSAPP: "WHATSAPP",
} as const;
export type CartBuilderSource = (typeof CartBuilderSource)[keyof typeof CartBuilderSource];

// How sure the cart builder is about a line: added for them, three to pick from, or nothing in stock
export const CartLineConfidence = {
  MATCHED: "MATCHED",
  PICK: "PICK",
  NOT_FOUND: "NOT_FOUND",
} as const;
export type CartLineConfidence = (typeof CartLineConfidence)[keyof typeof CartLineConfidence];

export const SearchSortLabels: Record<SearchSortBy, string> = {
  relevance: "Relevance",
  price_asc: "Price (low to high)",
  price_desc: "Price (high to low)",
  discount: "Discount (high to low)",
};

// Why a store product's stock changed (mirrors Prisma StockMovementType)
export const StockMovementType = {
  RECEIVE: "RECEIVE",
  COUNT: "COUNT",
  DAMAGE: "DAMAGE",
  EXPIRY: "EXPIRY",
  MANUAL: "MANUAL",
  SALE: "SALE",
  UNDO_SALE: "UNDO_SALE",
  RETURN: "RETURN",
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const StockMovementTypeLabels: Record<StockMovementType, string> = {
  RECEIVE: "Received",
  COUNT: "Stock count",
  DAMAGE: "Damaged",
  EXPIRY: "Expired",
  MANUAL: "Correction",
  SALE: "Sold",
  UNDO_SALE: "Delivery undone",
  RETURN: "Customer return",
};

// Blind stock count lifecycle (mirrors Prisma StockCountStatus)
export const StockCountStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  RECOUNT: "RECOUNT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type StockCountStatus = (typeof StockCountStatus)[keyof typeof StockCountStatus];

export * from "./marketing";
export * from "./notifications";
export * from "./home";
export * from "./ledger";
export * from "./onboarding";
export * from "./towns";
export * from "./storefront";
