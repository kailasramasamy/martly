import { DISCOUNTABLE_TARGETS } from "@martly/shared/constants";
import { startOfDayIso, parseNumber } from "./common";
import { validateTarget } from "./BannerTargetField";
import { draftPayload, hasErrors, validateDraft, type BannerDraft, type DraftErrors } from "./banner-draft";

export type StartMode = "now" | "ready" | "schedule";

export interface ManualPromoState {
  title: string;
  subtitle: string;
  actionType: string;
  actionTarget: string;
  discountType: "PERCENTAGE" | "FLAT" | null;
  discountValue: string;
  durationDays: string;
  start: StartMode;
  launchDate: string | null;
  notify: boolean;
  banners: BannerDraft[];
}

export interface ManualPromoErrors {
  title?: string;
  actionTarget?: string;
  discountValue?: string;
  durationDays?: string;
  launchDate?: string;
  banners: Record<string, DraftErrors>;
}

export const isDiscountable = (actionType: string) => (DISCOUNTABLE_TARGETS as readonly string[]).includes(actionType);

function validateDiscount(s: ManualPromoState): string | undefined {
  if (!s.discountType) return undefined;
  const value = parseNumber(s.discountValue);
  if (value === null || value <= 0) return "Enter a discount above 0";
  if (s.discountType === "PERCENTAGE" && value > 90) return "At most 90%";
  return undefined;
}

export function validateManual(s: ManualPromoState): { errors: ManualPromoErrors; ok: boolean } {
  const days = Number(s.durationDays);
  const banners = Object.fromEntries(s.banners.map((b) => [b.key, validateDraft(b)]));
  const errors: ManualPromoErrors = {
    title: s.title.trim().length >= 2 ? undefined : "Enter a title of at least 2 characters",
    actionTarget: validateTarget(s.actionType, s.actionTarget),
    discountValue: validateDiscount(s),
    durationDays: Number.isInteger(days) && days >= 1 && days <= 90 ? undefined : "Whole days, 1 to 90",
    launchDate: s.start === "schedule" && !s.launchDate ? "Pick a start date" : undefined,
    banners,
  };
  const { banners: bannerErrors, ...own } = errors;
  return { errors, ok: !hasErrors(own) && !Object.values(bannerErrors).some(hasErrors) };
}

export function manualPayload(s: ManualPromoState, pushAllowed: boolean, organizationId?: string) {
  return {
    title: s.title.trim(),
    subtitle: s.subtitle.trim() || undefined,
    actionType: s.actionType,
    actionTarget: s.actionType === "NONE" ? undefined : s.actionTarget.trim(),
    discountType: s.discountType ?? undefined,
    discountValue: s.discountType ? parseNumber(s.discountValue) : undefined,
    durationDays: Number(s.durationDays),
    launchNow: s.start === "now",
    launchAt: s.start === "schedule" && s.launchDate ? startOfDayIso(s.launchDate) : undefined,
    notify: pushAllowed && s.notify,
    organizationId,
    banners: s.banners.map((b, i) => ({ ...draftPayload(b, false), sortOrder: i })),
  };
}
