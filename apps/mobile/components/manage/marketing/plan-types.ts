export type BillingInterval = "MONTHLY" | "YEARLY";

export interface Entitlements {
  plan: { id: string; code: string; name: string; price: number; promotionCredits: number; pushIncluded: boolean; billingInterval: BillingInterval } | null;
  period: { startsAt: string; endsAt: string } | null;
  paidThrough: string | null;
  promotions: { planUsed: number; planTotal: number; planLeft: number; topUpBalance: number; resetsAt: string | null };
  listings: { included: number; used: number; planLeft: number; extraBalance: number; unlimited: boolean };
  pushIncluded: boolean;
  onPaidPlan: boolean;
  /** The org's stores on martlyshop.in now; empty on Free */
  webStores: { name: string; url: string }[];
  subscription: PlanSubscription | null;
}

export interface PlanSubscription {
  status: "CREATED" | "ACTIVE" | "PENDING" | "HALTED";
  productName: string;
  productCode: string;
  interval: BillingInterval;
  cancelAtPeriodEnd: boolean;
  renewsAt: string | null;
}

export interface AdProduct {
  id: string;
  kind: "STORE_PLAN" | "PROMOTION_TOPUP" | "LISTING_TOPUP" | "AI_IMAGE_PACK";
  code: string;
  name: string;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  durationDays: number;
  promotionCredits: number;
  pushIncluded: boolean;
  sortOrder: number;
  gstPercent: number;
}

export interface BillingProfile {
  name: string;
  billingName: string | null;
  gstin: string | null;
  billingAddress: string | null;
  billingState: string | null;
}

export interface AdOrderCheckout {
  orderId: string;
  total: number;
  checkout: { orderId: string; amount: number; currency: string; keyId: string };
}

export interface SubscriptionCheckout {
  subscriptionId: string;
  keyId: string;
  amount: number;
  startsAt: string | null;
}

export interface AdOrder {
  id: string;
  number: string | null;
  product: { name: string; kind: AdProduct["kind"] };
  quantity: number;
  total: number;
  status: string;
  paidAt: string | null;
  invoiceUrl: string | null;
}

export interface MarketingResults {
  days: number;
  promotions: { id: string; kind: string; title: string; status: string; startsAt: string | null; endsAt: string | null; imageUrl: string | null; views: number; taps: number; ctr: number; orders: number; units: number; revenue: number }[];
}

export interface BrandAdsSettings {
  boostOwnBrands: boolean;
  featuredBrands: { id: string; name: string; imageUrl: string | null }[];
}

export interface BrandCampaign {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  discountType: "FLAT" | "PERCENTAGE" | null;
  discountValue: number | null;
  brand: { id: string; name: string; imageUrl: string | null };
  packageName: string;
}
