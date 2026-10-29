import type { PromoSummary } from "@martly/shared/types";
import { formatINR } from "../ui/tokens";
import { TONES, type Tone } from "./common";

export const PROMO_STATUS: Record<PromoSummary["status"], Tone> = {
  DRAFTING: { label: "Drafting", ...TONES.blue },
  READY: { label: "Ready", ...TONES.amber },
  LIVE: { label: "Live", ...TONES.green },
  ENDED: { label: "Ended", ...TONES.slate },
  FAILED: { label: "Failed", ...TONES.red },
  DISCARDED: { label: "Discarded", ...TONES.slate },
};

export const PROMO_KIND: Record<PromoSummary["kind"], Tone> = {
  AI: { label: "Request", ...TONES.violet },
  MANUAL: { label: "Manual", ...TONES.slate },
};

export function discountLabel(type: PromoSummary["discountType"], value: number | null): string {
  if (!type || value == null) return "No discount";
  return type === "PERCENTAGE" ? `${value}% off` : `${formatINR(value)} off`;
}

export function priceRange(min: number, max: number): string {
  return min === max ? formatINR(min) : `${formatINR(min)}–${formatINR(max)}`;
}
