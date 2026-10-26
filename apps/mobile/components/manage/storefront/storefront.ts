import type { Href } from "expo-router";
import { STOREFRONT_CHECKS, type StorefrontCheckKey, type StorefrontCheckMeta } from "@martly/shared/constants";
import type { StorefrontCheckStatus, StorefrontHealth, StorefrontSuggestion } from "@martly/shared/types";
import { useLanguage } from "../../../lib/language-context";
import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";

type Text = { en: string; ta: string };

/** Picks the owner's language from a shared `{ en, ta }` text */
export function useBilingual() {
  const { language } = useLanguage();
  return (t: Text) => (language === "ta" ? t.ta : t.en);
}

export function useStorefrontHealth(storeId: string | null, fresh = false) {
  return useResource<StorefrontHealth>(storeId ? `/api/v1/storefront/health${toQuery({ storeId, fresh })}` : null);
}

export const CHECK_STATUS: Record<StorefrontCheckStatus, { label: string; color: string; bg: string }> = {
  ON: { label: "On", color: "#15803d", bg: "#dcfce7" },
  PARTIAL: { label: "Started", color: "#b45309", bg: "#fef3c7" },
  STALE: { label: "Lapsed", color: "#c2410c", bg: "#ffedd5" },
  OFF: { label: "Off", color: "#b91c1c", bg: "#fee2e2" },
  NA: { label: "Not needed", color: "#64748b", bg: "#f1f5f9" },
};

export const EVIDENCE: Record<NonNullable<StorefrontSuggestion["evidence"]>, string> = {
  DEALS_SELL: "Deal rows already drive your Home sales",
  UNDERPERFORMING: "It's live, but shoppers aren't tapping it",
  FESTIVAL_SOON: "A festival is coming up in your area",
};

/** The Manage screen where the owner sets a check up themselves */
export function setupHref(key: StorefrontCheckKey, storeId: string): Href {
  const pathname = STOREFRONT_CHECKS[key].screen.replace(":storeId", storeId);
  return { pathname, params: { storeId } } as Href;
}

/** Where "Do it with AI" goes: the form that drafts it, ready for the owner to review. Null when there's no AI help */
export function aiHref(key: StorefrontCheckKey, storeId: string): Href | null {
  const meta: StorefrontCheckMeta = STOREFRONT_CHECKS[key];
  switch (meta.ai) {
    case "BRANDING": return { pathname: "/manage/storefront/branding", params: { storeId, ai: "1" } };
    case "POST": return { pathname: "/manage/store-posts/new", params: { storeId, ai: "1" } };
    case "OFFER_PICKS": return { pathname: "/manage/offers/new", params: { storeId, ai: key === "BUY_GET" ? "BUY_GET" : "DISCOUNT" } };
    // The promo form is the promo agent: it writes the offer and banner from a short brief
    case "PROMO": return { pathname: "/manage/promos/new", params: { storeId } };
    // A festival collection hangs off the festival, which the AI builder doesn't pick, so it's set up by hand
    case "COLLECTION": return key === "FESTIVAL" ? null : { pathname: "/manage/storefront/hero-ai", params: { storeId, kind: key === "STORE_SPECIALS" ? "STORE_SPECIAL" : "STANDARD" } };
    default: return null;
  }
}
