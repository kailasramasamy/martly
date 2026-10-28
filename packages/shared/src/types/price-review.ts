import type { PriceReviewOutcome } from "../constants/index.js";

export interface PriceReviewDepartment {
  id: string;
  name: string;
  total: number;
  pending: number;
}

export interface PriceReviewSummary {
  total: number;
  pending: number;
  reviewed: number;
  kept: number;
  changed: number;
  /** Marked not sold here, from price review or stock check */
  notCarried: number;
  /** Listings carrying the store's own MRP */
  mrpCorrected: number;
  reviewedToday: number;
  /** Pending listings that sold in the last 30 days */
  topSellersPending: number;
  departments: PriceReviewDepartment[];
}

/** A brand or aisle to settle in one go */
export interface PriceReviewGroup {
  id: string;
  name: string;
  imageUrl: string | null;
  total: number;
  pending: number;
  /** The usual % below MRP across the group's listings, null when none has an MRP */
  typicalOffPct: number | null;
}

export interface PriceReviewItem {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  brandName: string | null;
  subcategoryName: string;
  /** What customers see: the store's MRP, else the catalog's */
  mrp: number | null;
  masterMrp: number | null;
  price: number;
  offPct: number | null;
  stock: number;
  isActive: boolean;
  outcome: PriceReviewOutcome | null;
  /** false once marked not sold here */
  carried: boolean | null;
  reviewedAt: string | null;
  unitsSold30d: number;
  /** Priced under half the MRP, which is usually a typo */
  suspicious: boolean;
}

/** How a queue's listings stand, for the tab counts; ignores the status tab picked */
export interface PriceReviewCounts {
  pending: number;
  KEPT: number;
  CHANGED: number;
  notCarried: number;
}

export interface PriceReviewResult {
  updated: number;
  /** The review time shared by every listing this call settled; pass it to reopen to undo */
  batch: string;
}
