// Paid marketing: what Martly sells to store owners and brands (mirrors Prisma enums)
export const AdProductKind = {
  STORE_PLAN: "STORE_PLAN",
  PROMOTION_TOPUP: "PROMOTION_TOPUP",
  LISTING_TOPUP: "LISTING_TOPUP",
  AI_IMAGE_PACK: "AI_IMAGE_PACK",
  BRAND_BANNER: "BRAND_BANNER",
  BRAND_TAKEOVER: "BRAND_TAKEOVER",
  BRAND_PROMOTION: "BRAND_PROMOTION",
  BRAND_CPM: "BRAND_CPM",
  BRAND_SPONSORED_PRODUCT: "BRAND_SPONSORED_PRODUCT",
  BRAND_FEATURE: "BRAND_FEATURE",
  BRAND_TAB_SLOT: "BRAND_TAB_SLOT",
} as const;
export type AdProductKind = (typeof AdProductKind)[keyof typeof AdProductKind];

export const AdProductKindLabels: Record<AdProductKind, string> = {
  STORE_PLAN: "Store plan",
  PROMOTION_TOPUP: "Extra promotion",
  LISTING_TOPUP: "Extra product listing",
  AI_IMAGE_PACK: "AI image pack",
  BRAND_BANNER: "Brand banner",
  BRAND_TAKEOVER: "Category takeover",
  BRAND_PROMOTION: "Brand promotion",
  BRAND_CPM: "Brand views (per 1,000)",
  BRAND_SPONSORED_PRODUCT: "Sponsored product",
  BRAND_FEATURE: "Featured brand",
  BRAND_TAB_SLOT: "Brand tab slot",
};

/** What an organisation's AI images were spent on (mirrors Prisma enum AiImagePurpose) */
export const AiImagePurpose = {
  PROMO_BANNER: "PROMO_BANNER",
  COLLECTION_BANNER: "COLLECTION_BANNER",
  FESTIVE_HERO: "FESTIVE_HERO",
  HOME_TILES: "HOME_TILES",
} as const;
export type AiImagePurpose = (typeof AiImagePurpose)[keyof typeof AiImagePurpose];

/**
 * AI images an action takes from the allowance, counted as finished images the owner gets (repaints on our side are
 * free). A festival hero reserves its strip and up to 6 tiles and gives back what it doesn't paint; Home tile art
 * takes one per tile.
 */
export const AI_IMAGE_COST = {
  PROMO_BANNER: 1,
  COLLECTION_BANNER: 1,
  FESTIVE_HERO: 7,
  HOME_TILE: 1,
} as const;

/** Below this share of the month's allowance left, the app nudges the owner to buy more */
export const AI_IMAGES_LOW_SHARE = 0.2;

/** Packages sold to brands, as opposed to store owners */
export const BRAND_PRODUCT_KINDS: readonly AdProductKind[] = ["BRAND_BANNER", "BRAND_TAKEOVER", "BRAND_PROMOTION", "BRAND_CPM", "BRAND_SPONSORED_PRODUCT", "BRAND_FEATURE", "BRAND_TAB_SLOT"];

export const AdOrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;
export type AdOrderStatus = (typeof AdOrderStatus)[keyof typeof AdOrderStatus];

export const PromoCharge = {
  PLAN: "PLAN",
  TOPUP: "TOPUP",
  BRAND: "BRAND",
  PLATFORM: "PLATFORM",
} as const;
export type PromoCharge = (typeof PromoCharge)[keyof typeof PromoCharge];

export const SponsorType = {
  STORE: "STORE",
  BRAND: "BRAND",
  PLATFORM: "PLATFORM",
} as const;
export type SponsorType = (typeof SponsorType)[keyof typeof SponsorType];

export const SponsorTypeLabels: Record<SponsorType, string> = {
  STORE: "Store",
  BRAND: "Brand",
  PLATFORM: "Martly",
};

export const BrandCampaignStatus = {
  DRAFT: "DRAFT",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  IN_REVIEW: "IN_REVIEW",
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  ENDED: "ENDED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type BrandCampaignStatus = (typeof BrandCampaignStatus)[keyof typeof BrandCampaignStatus];

export const BrandCampaignStatusLabels: Record<BrandCampaignStatus, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Awaiting payment",
  IN_REVIEW: "In review",
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  ENDED: "Ended",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/** Indian states for GST place of supply; same state as the seller means CGST + SGST, otherwise IGST */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

/** What a manually uploaded banner image must meet; shown next to every upload field */
export const BANNER_IMAGE_REQUIREMENTS = {
  width: 1200,
  height: 800,
  aspect: "3:2",
  maxBytes: 5 * 1024 * 1024,
  formats: ["JPG", "PNG", "WebP"],
  guidance: [
    "Landscape 3:2, at least 1200 × 800 px (1800 × 1200 looks sharpest)",
    "JPG, PNG or WebP, up to 5 MB",
    "Keep text and logos inside the middle 80%; edges may be cropped on small phones",
    "Large, bold text with strong contrast; no more than about 8 words",
    "No borders, phone frames, QR codes or prices that may change",
  ],
} as const;

/** AI promotions are drafted by the agent from a brief; manual ones are set up by hand */
export const PromoKind = {
  AI: "AI",
  MANUAL: "MANUAL",
} as const;
export type PromoKind = (typeof PromoKind)[keyof typeof PromoKind];

/** What a manual promotion's discount can cover; search and links don't map to a set of products */
export const DISCOUNTABLE_TARGETS = ["CATEGORY", "PRODUCT", "COLLECTION", "BRAND"] as const;

// Why a product ranks ahead in a store: the organisation's own brand, or a brand paying Martly to be featured (shown on the card)
export const BrandPick = {
  OWN: "OWN",
  FEATURED: "FEATURED",
} as const;
export type BrandPick = (typeof BrandPick)[keyof typeof BrandPick];

// Unbranded products in this department are the store's own packs (rice, dal, flour…), promoted as "Our brand"
export const STORE_BRAND_DEPARTMENT_SLUG = "grocery-staples";

// The store's own brand as one brand id: everything it sells as "Our brand", under its name and logo
const OWN_BRAND_PREFIX = "own-";
export const ownBrandId = (storeId: string) => `${OWN_BRAND_PREFIX}${storeId}`;
export const ownBrandStoreId = (brandId: string) => (brandId.startsWith(OWN_BRAND_PREFIX) ? brandId.slice(OWN_BRAND_PREFIX.length) : null);

// Store-name endings that aren't part of the brand: "Sree Ranga Store" sells as "Sree Ranga"
const STORE_NAME_SUFFIX = /\s+(department\s+stores?|super\s*markets?|stores?|mart)\s*$/i;

/** The name a store sells its own packs under: the brand name it set, else its name without "Store" */
export function storeBrandName(store: { name: string; brandName?: string | null }): string {
  return store.brandName?.trim() || store.name.replace(STORE_NAME_SUFFIX, "").trim() || store.name;
}

/** A product title with the store's brand in front, as branded products carry theirs; never doubled */
export function withStoreBrand(title: string, brand: string): string {
  return title.toLowerCase().startsWith(brand.toLowerCase()) ? title : `${brand} ${title}`;
}

/** Own-brand or local products each store plan lists free, counted once over the store's life; each one after that costs LISTING_FEE, once */
export const OWN_LISTINGS_INCLUDED: Record<string, number> = { FREE: 10, GROWTH: 25, PRO: 50 };
export const LISTING_FEE = 100;
/** Size of the master catalog stores list from free, as owners are told it */
export const CATALOG_SIZE_LABEL = "12,000+";
