export interface Entitlements {
  plan: { id: string; code: string; name: string; price: number; bannerSlots: number | null; promotionCredits: number; pushIncluded: boolean; aiImagesPerMonth: number } | null;
  period: { startsAt: string; endsAt: string } | null;
  paidThrough: string | null;
  bannerSlots: { used: number; total: number | null };
  promotions: { planUsed: number; planTotal: number; planLeft: number; topUpBalance: number; resetsAt: string | null };
  pushIncluded: boolean;
  aiImages: { used: number; total: number };
}

export interface AdProduct {
  id: string;
  kind: "STORE_PLAN" | "PROMOTION_TOPUP";
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  bannerSlots: number | null;
  promotionCredits: number;
  aiImagesPerMonth: number;
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
  banners: { id: string; title: string; imageUrl: string; placement: string; sponsorType: string; isActive: boolean; promoId: string | null; views: number; taps: number; ctr: number }[];
  promotions: { id: string; brief: string; status: string; startsAt: string | null; endsAt: string | null; orders: number; units: number; revenue: number }[];
}

export interface BrandAdsSettings {
  allowBrandAds: boolean;
  blockedBrands: { id: string; name: string; imageUrl: string | null }[];
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
  optedOut: boolean;
}
