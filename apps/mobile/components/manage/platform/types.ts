import type { AdProductKind, BannerActionType, BrandCampaignStatus } from "@martly/shared/constants";

/** Martly's platform screens in Manage (super admin): brand campaigns, partners, ad pricing and marketing revenue */

export interface BrandRef { id: string; name: string; imageUrl: string | null }

/** A brand package on sale, as GET /brand-campaigns/packages returns it */
export interface BrandPackage {
  id: string;
  kind: AdProductKind;
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  /** Null for a featured brand, which runs no banner */
  placement: string | null;
  viewsPerUnit: number | null;
  isActive: boolean;
  sortOrder: number;
  gstPercent: number;
}

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

/** GET /brand-campaigns and /brand-campaigns/:id */
export interface Campaign {
  id: string;
  brandId: string;
  productId: string;
  status: BrandCampaignStatus;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  brief: string | null;
  /** Null for a featured brand */
  placement: string | null;
  categoryId: string | null;
  actionType: BannerActionType;
  actionTarget: string | null;
  targetStoreIds: string[];
  targetStates: string[];
  targetDistricts: string[];
  discountType: "PERCENTAGE" | "FLAT" | null;
  discountValue: number | null;
  quantity: number;
  startsAt: string;
  endsAt: string;
  reviewNote: string | null;
  brand: BrandRef;
  product: { id: string; code: string; name: string; kind: AdProductKind; price: number; durationDays: number; viewsPerUnit: number | null };
  category: { id: string; name: string } | null;
  adOrder: { id: string; number: string | null; status: string; total: number; paidAt: string | null; invoiceUrl: string | null } | null;
  _count: { promos: number };
  results: { stores: CampaignResultRow[]; total: Omit<CampaignResultRow, "storeId" | "store"> } | null;
}

/** GET /brand-campaigns/availability: how full the package's slot is for these dates */
export interface SlotAvailability {
  cap: number | null;
  booked: number;
  available: boolean;
  /** When full: the earliest start from which the whole booking fits */
  nextStartsAt: string | null;
  startsAt: string;
  endsAt: string;
}

/** GET /brand-campaigns/brand-categories: where a brand can be featured, most products first */
export interface BrandCategory { id: string; name: string; department: string; products: number }

/** GET /brand-campaigns/regions */
export interface Region { state: string; district: string | null; stores: number }

/** Not live yet; once paid (in review or scheduled) only the dates and where it runs change, plus the creative until approved */
export const EDITABLE_STATUSES: BrandCampaignStatus[] = ["DRAFT", "PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED"];
export const PAID_STATUSES: BrandCampaignStatus[] = ["IN_REVIEW", "SCHEDULED"];
export const CREATIVE_STATUSES: BrandCampaignStatus[] = ["DRAFT", "PENDING_PAYMENT", "IN_REVIEW"];

/** GET /brand-campaigns/partners */
export interface BrandPartner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  deletedAt: string | null;
  brand: { id: string; name: string } | null;
}

/** A campaign holding a slot on a calendar day */
export interface CalendarCampaign {
  id: string;
  title: string;
  status: BrandCampaignStatus;
  startsAt: string;
  endsAt: string;
  brand: { id: string; name: string; imageUrl: string | null };
}

/** One IST day of GET /brand-campaigns/calendar */
export interface CalendarDay {
  /** "YYYY-MM-DD" */
  date: string;
  /** Most campaigns running at once that day */
  booked: number;
  /** Earliest moment a booking of this length can start and fit, or null when it can't start that day */
  startsAt: string | null;
  campaigns: CalendarCampaign[];
}

export interface SlotCalendar {
  cap: number | null;
  days: CalendarDay[];
}
