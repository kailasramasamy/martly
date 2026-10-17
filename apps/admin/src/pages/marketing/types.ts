import type { AdProductKind } from "@martly/shared/constants";

export type BillingInterval = "MONTHLY" | "YEARLY";

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
  pushIncluded: boolean;
  placement: string | null;
  viewsPerUnit: number | null;
  isActive: boolean;
  sortOrder: number;
  /** Sent with packages on sale (not by the pricing page) */
  gstPercent?: number;
}

export interface BillingProfile {
  billingName: string | null;
  gstin: string | null;
  billingAddress: string | null;
  billingState: string | null;
}

export type BillingValues = {
  billingName: string;
  gstin?: string;
  billingAddress: string;
  billingState: string;
};

export interface Entitlements {
  plan: { id: string; code: string; name: string; price: number; promotionCredits: number; pushIncluded: boolean; aiImagesPerMonth: number; billingInterval: BillingInterval } | null;
  period: { startsAt: string; endsAt: string } | null;
  paidThrough: string | null;
  promotions: { planUsed: number; planTotal: number; planLeft: number; topUpBalance: number; resetsAt: string | null };
  pushIncluded: boolean;
  aiImages: { used: number; total: number };
  onPaidPlan: boolean;
  trial: { available: boolean; endsAt: string | null };
  subscription: {
    status: "CREATED" | "ACTIVE" | "PENDING" | "HALTED";
    productName: string;
    productCode: string;
    interval: BillingInterval;
    cancelAtPeriodEnd: boolean;
    renewsAt: string | null;
  } | null;
}
