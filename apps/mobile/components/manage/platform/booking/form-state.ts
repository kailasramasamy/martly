import type { AdProductKind } from "@martly/shared/constants";
import { fromDateKey, toDateKey } from "../../ui/dates";
import type { BrandPackage, Campaign } from "../types";

export type TargetMode = "ALL" | "REGIONS" | "STORES";
export type CreativeMode = "upload" | "ai";
export type DiscountType = "PERCENTAGE" | "FLAT";

export interface FormState {
  brandId: string | null;
  productId: string | null;
  quantity: string;
  startDate: string;
  /** An exact start on that day: the next opening picked with "Start then", or an edited campaign's saved start */
  startTime: string | null;
  categoryId: string | null;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  brief: string;
  actionTarget: string | null;
  creativeMode: CreativeMode;
  targetMode: TargetMode;
  storeIds: string[];
  states: string[];
  districts: string[];
  discountType: DiscountType | null;
  discountValue: string;
}

export type FormErrors = Partial<Record<keyof FormState, string>>;

const DEFAULT_START_DAYS = 3;

export const isKind = (p: BrandPackage | undefined, kind: AdProductKind) => p?.kind === kind;
export const isSponsored = (p?: BrandPackage) => isKind(p, "BRAND_SPONSORED_PRODUCT");
export const isFeature = (p?: BrandPackage) => isKind(p, "BRAND_FEATURE");
export const isTabSlot = (p?: BrandPackage) => isKind(p, "BRAND_TAB_SLOT");
export const isPoster = (p?: BrandPackage) => p?.placement === "HOME_POSTER";
/** Featured brands and tab slots run no banner; sponsored products borrow the product photo */
export const hasNoCreative = (p?: BrandPackage) => isFeature(p) || isTabSlot(p) || isSponsored(p);

export const inferTargetMode = (c: Pick<Campaign, "targetStoreIds" | "targetStates" | "targetDistricts">): TargetMode =>
  c.targetStoreIds.length ? "STORES" : c.targetStates.length || c.targetDistricts.length ? "REGIONS" : "ALL";

/** A well-formed "YYYY-MM-DD" that isn't in the past, e.g. from a calendar deep link */
const usableStartDate = (key?: string): key is string => !!key && /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= toDateKey(new Date());

export function initialState(startDate?: string): FormState {
  const start = new Date();
  start.setDate(start.getDate() + DEFAULT_START_DAYS);
  return {
    brandId: null, productId: null, quantity: "1", startDate: usableStartDate(startDate) ? startDate : toDateKey(start), startTime: null, categoryId: null, title: "", subtitle: "",
    imageUrl: null, brief: "", actionTarget: null, creativeMode: "upload", targetMode: "ALL", storeIds: [], states: [], districts: [],
    discountType: null, discountValue: "",
  };
}

export function stateFromCampaign(c: Campaign): FormState {
  return {
    brandId: c.brandId, productId: c.productId, quantity: String(c.quantity), startDate: toDateKey(new Date(c.startsAt)), startTime: c.startsAt,
    categoryId: c.categoryId, title: c.title, subtitle: c.subtitle ?? "", imageUrl: c.imageUrl, brief: c.brief ?? "",
    actionTarget: c.actionTarget, creativeMode: c.imageUrl || !c.brief ? "upload" : "ai", targetMode: inferTargetMode(c),
    storeIds: c.targetStoreIds, states: c.targetStates, districts: c.targetDistricts,
    discountType: c.discountType, discountValue: c.discountValue === null ? "" : String(c.discountValue),
  };
}

/** The exact start when it's on the chosen day; otherwise today starts now (midnight is past) and other days at midnight */
export function startsAtIso({ startDate, startTime }: Pick<FormState, "startDate" | "startTime">): string {
  if (startTime && toDateKey(new Date(startTime)) === startDate) return startTime;
  return (startDate === toDateKey(new Date()) ? new Date() : fromDateKey(startDate)).toISOString();
}

export function validate(s: FormState, product: BrandPackage | undefined): FormErrors {
  const e: FormErrors = {};
  const qty = Number(s.quantity);
  if (!s.brandId) e.brandId = "Choose a brand";
  if (!s.productId) e.productId = "Choose a package";
  if (!Number.isInteger(qty) || qty < 1 || qty > 52) e.quantity = "Enter a whole number from 1 to 52";
  if (!s.startDate) e.startDate = "Pick a start date";
  if ((isKind(product, "BRAND_TAKEOVER") || isFeature(product)) && !s.categoryId) e.categoryId = "Choose a category";
  if (isKind(product, "BRAND_PROMOTION")) {
    const value = Number(s.discountValue);
    if (!s.discountType) e.discountType = "Choose a discount type";
    if (!Number.isFinite(value) || value < 1 || value > 90) e.discountValue = "Enter 1 to 90";
  }
  if (isSponsored(product)) {
    if (!s.actionTarget) e.actionTarget = "Pick one of the brand's products";
    return e;
  }
  if (s.title.trim().length < 2) e.title = "Enter 2 to 60 characters";
  if (hasNoCreative(product)) return e;
  if (s.creativeMode === "upload" && !s.imageUrl) e.imageUrl = isPoster(product) ? "Upload a poster image" : "Upload a banner image";
  if (s.creativeMode === "ai" && !s.brief.trim()) e.brief = `Describe the ${isPoster(product) ? "poster" : "banner"}`;
  return e;
}

export function buildBody(s: FormState, product: BrandPackage | undefined) {
  const sponsored = isSponsored(product);
  const bare = hasNoCreative(product);
  return {
    brandId: s.brandId,
    productId: s.productId,
    quantity: Number(s.quantity),
    startsAt: startsAtIso(s),
    categoryId: s.categoryId,
    title: s.title,
    subtitle: s.subtitle || null,
    imageUrl: bare ? null : s.imageUrl,
    brief: s.creativeMode === "ai" && !bare ? s.brief : null,
    ...(sponsored ? { actionType: "PRODUCT", actionTarget: s.actionTarget } : {}),
    targetStoreIds: s.targetMode === "STORES" ? s.storeIds : [],
    targetStates: s.targetMode === "REGIONS" ? s.states : [],
    targetDistricts: s.targetMode === "REGIONS" ? s.districts : [],
    discountType: s.discountType,
    discountValue: s.discountValue ? Number(s.discountValue) : null,
  };
}
