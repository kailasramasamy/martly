// Paid marketing: what Martly sells to store owners and brands (mirrors Prisma enums)
export const AdProductKind = {
  STORE_PLAN: "STORE_PLAN",
  PROMOTION_TOPUP: "PROMOTION_TOPUP",
  BRAND_BANNER: "BRAND_BANNER",
  BRAND_TAKEOVER: "BRAND_TAKEOVER",
  BRAND_PROMOTION: "BRAND_PROMOTION",
  BRAND_CPM: "BRAND_CPM",
} as const;
export type AdProductKind = (typeof AdProductKind)[keyof typeof AdProductKind];

export const AdProductKindLabels: Record<AdProductKind, string> = {
  STORE_PLAN: "Store plan",
  PROMOTION_TOPUP: "Extra promotion",
  BRAND_BANNER: "Brand banner",
  BRAND_TAKEOVER: "Category takeover",
  BRAND_PROMOTION: "Brand promotion",
  BRAND_CPM: "Brand views (per 1,000)",
};

/** Packages sold to brands, as opposed to store owners */
export const BRAND_PRODUCT_KINDS: readonly AdProductKind[] = ["BRAND_BANNER", "BRAND_TAKEOVER", "BRAND_PROMOTION", "BRAND_CPM"];

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
