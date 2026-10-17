export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "FLAT" | "PERCENTAGE";
  discountValue: string | number;
  minOrderAmount: string | number | null;
  maxDiscount: string | number | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  textInImage: boolean;
  placement: string;
  actionType: string;
  actionTarget: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storeId: string | null;
  organizationId: string | null;
  departmentId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  organization: { id: string; name: string } | null;
  store: { id: string; name: string } | null;
  /** Set when a promotion owns this banner; it is managed from the promotion */
  promo: { id: string; kind: "AI" | "MANUAL"; status: string } | null;
}

export interface FestivalCollection {
  id: string;
  title: string;
  isActive: boolean;
  source: "MANUAL" | "AGENT";
  organizationId: string | null;
}

export interface FestivalEvent {
  id: string;
  name: string;
  slug: string;
  kind: "OCCASION" | "SEASON";
  startsAt: string;
  endsAt: string;
  leadDays: number;
  regions: string[];
  guidance: string | null;
  isActive: boolean;
  collections: FestivalCollection[];
  phase: "LIVE" | "UPCOMING" | "ENDED";
  liveFrom: string;
}

export interface FestivalSummary {
  total: number;
  live: number;
  upcoming30d: number;
  curated: number;
  awaitingGoLive: number;
  vetoed: number;
}

export interface CurateResult {
  organizationId: string;
  collectionId?: string;
  status: "created" | "exists" | "skipped";
  reason?: string;
}
