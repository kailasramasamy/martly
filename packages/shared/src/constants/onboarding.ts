import type { FestivalRegion } from "./index";
import type { INDIAN_STATES } from "./marketing";

export const StoreSize = {
  KIRANA: "KIRANA",
  SUPERMARKET: "SUPERMARKET",
  HYPERMARKET: "HYPERMARKET",
} as const;
export type StoreSize = (typeof StoreSize)[keyof typeof StoreSize];

export const SubcategoryTier = {
  ESSENTIAL: "ESSENTIAL",
  STANDARD: "STANDARD",
  EXTENDED: "EXTENDED",
} as const;
export type SubcategoryTier = (typeof SubcategoryTier)[keyof typeof SubcategoryTier];

export interface StoreSizeRule {
  label: string;
  description: string;
  tiers: SubcategoryTier[];
  brandsPerAisle: number;
  productsPerAisle: number;
}

/** What each shop format carries in its proposed catalog; an aisle is a subcategory */
export const STORE_SIZE_RULES: Record<StoreSize, StoreSizeRule> = {
  KIRANA: {
    label: "Kirana",
    description: "Neighbourhood shop: daily essentials from the best-known brands",
    tiers: ["ESSENTIAL"],
    brandsPerAisle: 3,
    productsPerAisle: 8,
  },
  SUPERMARKET: {
    label: "Supermarket",
    description: "Regular supermarket: every everyday aisle with a choice of brands",
    tiers: ["ESSENTIAL", "STANDARD"],
    brandsPerAisle: 6,
    productsPerAisle: 25,
  },
  HYPERMARKET: {
    label: "Large supermarket",
    description: "Wide range: niche and premium aisles too, with deep brand choice",
    tiers: ["ESSENTIAL", "STANDARD", "EXTENDED"],
    brandsPerAisle: 12,
    productsPerAisle: 60,
  },
};

/** Brands with this region are sold everywhere */
export const NATIONAL_REGION = "ALL";

/** The region a store's state shops in, for brand relevance; states without a region code use national brands only */
export const STATE_TO_REGION: Partial<Record<(typeof INDIAN_STATES)[number], Exclude<FestivalRegion, "ALL">>> = {
  "Tamil Nadu": "TN",
  Puducherry: "TN",
  Karnataka: "KA",
  Kerala: "KL",
  "Andhra Pradesh": "AP",
  Telangana: "TS",
  Maharashtra: "MH",
  Gujarat: "GJ",
  "West Bengal": "WB",
  Punjab: "PB",
  Delhi: "DL",
  "Uttar Pradesh": "UP",
};
