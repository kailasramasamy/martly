import type { BannerActionType, BrandCampaignStatus } from "@martly/shared/constants";

/** Where a campaign screen reads and writes: the platform admin's endpoints or a brand partner's own */
export interface CampaignScope {
  apiBase: string;
  /** Admin route prefix the screens navigate within */
  path: string;
  mode: "platform" | "brand";
}

export const PLATFORM_SCOPE: CampaignScope = { apiBase: "/brand-campaigns", path: "/brand-campaigns", mode: "platform" };
export const BRAND_SCOPE: CampaignScope = { apiBase: "/brand-portal/campaigns", path: "/brand-portal/campaigns", mode: "brand" };

export interface BrandRef { id: string; name: string; imageUrl: string | null }

export interface CampaignResultRow {
  storeId: string;
  store: string;
  views: number;
  taps: number;
  ctr: number;
  orders: number;
  units: number;
  revenue: number;
}

export interface Campaign {
  id: string;
  brandId: string;
  productId: string;
  status: BrandCampaignStatus;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  brief: string | null;
  placement: string;
  categoryId: string | null;
  actionType: BannerActionType;
  actionTarget: string | null;
  targetStoreIds: string[];
  discountType: "PERCENTAGE" | "FLAT" | null;
  discountValue: number | null;
  quantity: number;
  startsAt: string;
  endsAt: string;
  reviewNote: string | null;
  brand: BrandRef;
  product: { id: string; code: string; name: string; kind: string; price: number; durationDays: number; viewsPerUnit: number | null };
  category: { id: string; name: string } | null;
  adOrder: { id: string; number: string | null; status: string; total: number; paidAt: string | null; invoiceUrl: string | null } | null;
  _count: { promos: number; optOuts: number };
  results: { stores: CampaignResultRow[]; total: Omit<CampaignResultRow, "storeId" | "store"> } | null;
}

export const EDITABLE_STATUSES: BrandCampaignStatus[] = ["DRAFT", "PENDING_PAYMENT", "IN_REVIEW"];
