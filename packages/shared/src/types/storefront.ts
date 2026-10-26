import type { StorefrontCheckKey, StorefrontGroup } from "../constants/storefront.js";

/** ON: done. PARTIAL: started, `have` of `need`. STALE: was on, has lapsed. OFF: not set up. NA: doesn't apply to this store */
export type StorefrontCheckStatus = "ON" | "PARTIAL" | "STALE" | "OFF" | "NA";

export interface StorefrontCheckResult {
  key: StorefrontCheckKey;
  status: StorefrontCheckStatus;
  /** 0 to 1: how much of the check's weight the store earns */
  earned: number;
  have?: number;
  need?: number;
  /** Hero cards the layout asks for and whether each has enough to show */
  cards?: { kind: string; ready: boolean; collectionId?: string; title?: string; have?: number; need?: number }[];
  /** On, but shoppers aren't responding (e.g. banners nobody taps) */
  underperforming?: boolean;
}

export interface StorefrontSuggestion {
  key: StorefrontCheckKey;
  /** Score points the store gains by doing it */
  gain: number;
  /** Why it ranks where it does, when there's evidence beyond the weight */
  evidence?: "DEALS_SELL" | "UNDERPERFORMING" | "FESTIVAL_SOON";
}

export interface StorefrontHealth {
  storeId: string;
  /** 0 to 100 */
  score: number;
  /** 0 to 100 per group; null when nothing in the group applies */
  groups: Record<StorefrontGroup, number | null>;
  checks: StorefrontCheckResult[];
  suggestions: StorefrontSuggestion[];
  /** Daily scores, oldest first, up to 30 days */
  trend: { date: string; score: number }[];
  /** What the store's marketing plan still allows this period */
  allowance: { promotions: number; aiImages: number };
}

export interface SectionEffect {
  sectionId: string;
  sectionType: string;
  title: string | null;
  views: number;
  /** Every tap counts but a view only once per visit, so taps can outnumber views */
  taps: number;
  cartAdds: number;
  orders: number;
  revenue: number;
}

export interface OfferEffect {
  orders: number;
  units: number;
  revenue: number;
}

export interface StorefrontEffectiveness {
  storeId: string;
  days: number;
  sections: SectionEffect[];
  offers: { buyGet: OfferEffect; discount: OfferEffect; coupons: { redemptions: number; discount: number } };
  banners: { bannerId: string; title: string | null; views: number; taps: number; ctr: number }[];
  /** Share of the period's revenue from items added on Home, 0 to 100 */
  homeRevenueShare: number;
  revenue: number;
}

export interface StorefrontStoreRow {
  storeId: string;
  storeName: string;
  organizationName: string;
  score: number;
  groups: Record<StorefrontGroup, number | null>;
  /** Score change over the last 7 days; null without a week of history */
  weekChange: number | null;
}
