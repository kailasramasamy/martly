import type { AdProductKind } from "@martly/shared/constants";

/** One row of GET /api/v1/marketing-admin/pricing; the PUT sends the whole list back */
export interface AdProduct {
  id: string;
  kind: AdProductKind;
  code: string;
  name: string;
  description: string | null;
  price: number;
  /** Store plans: price for a year paid up front; null means no annual option */
  yearlyPrice: number | null;
  durationDays: number;
  promotionCredits: number;
  aiImagesPerMonth: number;
  aiImageCredits: number;
  pushIncluded: boolean;
  placement: string | null;
  viewsPerUnit: number | null;
  isActive: boolean;
  sortOrder: number;
  gstPercent?: number;
}

export type SlotLimits = Record<string, { BRAND?: number | null }>;

export interface PricingConfig {
  gstPercent: number;
  slotLimits: SlotLimits;
  freeRegenerations: number;
  featuredBrandSlots: number;
  sellerName: string;
  sellerGstin: string | null;
  sellerState: string;
  sellerAddress: string | null;
  invoicePrefix: string;
}

export interface PricingData { products: AdProduct[]; config: PricingConfig }

/** Drops empty caps (no cap) and placements left with none */
export function cleanSlotLimits(limits: SlotLimits | undefined): SlotLimits {
  const cleaned: SlotLimits = {};
  for (const [placement, caps] of Object.entries(limits ?? {})) {
    if (typeof caps?.BRAND === "number") cleaned[placement] = { BRAND: caps.BRAND };
  }
  return cleaned;
}
