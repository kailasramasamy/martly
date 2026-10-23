import type { AdProductKind } from "@martly/shared/constants";

const KIND_COLORS: Partial<Record<AdProductKind, string>> = {
  BRAND_BANNER: "#0d9488",
  BRAND_TAKEOVER: "#2563eb",
  BRAND_PROMOTION: "#d97706",
  BRAND_SPONSORED_PRODUCT: "#db2777",
  BRAND_FEATURE: "#16a34a",
  BRAND_TAB_SLOT: "#475569",
  BRAND_CPM: "#9ca3af",
};

// Posters share the banner package kind and differ by placement, so they get their own colour
const POSTER_COLOR = "#7c3aed";

export const campaignColor = (c: { placement: string | null; product: { kind: AdProductKind } }) =>
  c.placement === "HOME_POSTER" ? POSTER_COLOR : KIND_COLORS[c.product.kind] ?? "#64748b";
