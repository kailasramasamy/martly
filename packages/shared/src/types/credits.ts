import type { CreditGrantStatus } from "../constants/credits.js";

export type CreditTranslations = Record<string, { headline?: string; message?: string }>;

/** What a new customer can get at a store, for banners and the login screen */
export interface CreditOffer {
  campaignId: string;
  /** null when Martly pays */
  storeId: string | null;
  storeName: string | null;
  amount: number;
  minOrderAmount: number;
  validDays: number;
  /** The funder's own copy; the app words it from the amount when empty */
  headline: string | null;
  message: string | null;
  translations: CreditTranslations | null;
}

export interface CreditGrantView {
  id: string;
  campaignId: string;
  storeId: string | null;
  storeName: string | null;
  storeLogoUrl: string | null;
  amount: number;
  minOrderAmount: number;
  status: CreditGrantStatus;
  expiresAt: string;
  announced: boolean;
  headline: string | null;
  message: string | null;
  translations: CreditTranslations | null;
}

export interface CustomerCredits {
  /** Unused, unexpired credit the customer holds */
  grants: CreditGrantView[];
  /** Offers the customer qualifies for but hasn't been given, e.g. because no store delivers to them yet */
  pending: CreditOffer[];
}

/** The credit a checkout at this store would take off, given its items total after coupon */
export interface CheckoutCredit {
  amount: number;
  grantIds: string[];
}

export interface CreditCampaignUsage {
  granted: number;
  outstanding: number;
  reserved: number;
  spent: number;
  expired: number;
  grantCount: number;
  usedCount: number;
  /** Spent plus reserved, against the budget */
  committed: number;
  /** Outstanding credit that could still be spent after the budget is reached */
  possibleOverrun: number;
}

export interface CreditCampaignRow {
  id: string;
  organizationId: string | null;
  storeId: string | null;
  storeName: string | null;
  amount: number;
  minOrderAmount: number;
  validDays: number;
  budget: number;
  headline: string | null;
  message: string | null;
  translations: CreditTranslations | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  usage: CreditCampaignUsage;
}
