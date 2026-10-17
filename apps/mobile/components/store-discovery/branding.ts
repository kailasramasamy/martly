import { colors } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import type { Store } from "../../lib/types";

export interface StoreBranding {
  color: string;
  /** Text and icons drawn on top of `color` */
  onColor: string;
  /** `color` faded for chip backgrounds */
  tint: string;
  initials: string;
  tagline: string | null;
  offer: { icon: "pricetag" | "flash" | "bicycle"; text: string } | null;
}

/** Light brand colours (yellows, pastels) need dark text to stay readable */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || name.slice(0, 1);

/** The store's own offer line, else its live deals, else free delivery */
function offerFor(store: Store, offerText: string | undefined): StoreBranding["offer"] {
  if (offerText) return { icon: "pricetag", text: offerText };
  if (store.deals) return { icon: "flash", text: `Up to ${store.deals.maxPercent}% off · ${store.deals.count} deals` };
  if (store.freeDeliveryThreshold != null) return { icon: "bicycle", text: `Free delivery above ₹${Number(store.freeDeliveryThreshold).toLocaleString("en-IN")}` };
  return null;
}

export function useStoreBranding(store: Store): StoreBranding {
  const { language } = useLanguage();
  const local = language ? store.translations?.[language] : undefined;
  const color = store.brandColor ?? colors.primary;
  return {
    color,
    onColor: isLight(color) ? colors.text : "#fff",
    tint: `${color}1a`,
    initials: initialsOf(store.name),
    tagline: local?.tagline || store.tagline || null,
    offer: offerFor(store, local?.offerText || store.offerText || undefined),
  };
}
