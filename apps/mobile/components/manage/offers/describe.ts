import type { StoreOffer, StoreOfferStatus } from "@martly/shared/types";
import { formatDate } from "../ui/dates";
import { formatINR } from "../ui/tokens";
import { offerLabel } from "../inventory/draft";

export const OFFER_TABS: { value: StoreOfferStatus; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
];

/** "Buy 2 Get 1", "20% off" or "₹10 off" */
export function offerText(o: StoreOffer): string {
  if (o.kind === "BUY_GET") return offerLabel({ buy: o.buy!, get: o.get! });
  if (o.kind === "MEMBER_PRICE") return `Members pay ${formatINR(o.memberPrice!)} (price ${formatINR(o.price)})`;
  return o.discountType === "PERCENTAGE" ? `${o.discountValue}% off` : `${formatINR(o.discountValue!)} off`;
}

export function offerDates(o: StoreOffer): string {
  if (o.kind === "MEMBER_PRICE") return "Mart Plus members, always on";
  const from = o.startsAt ? `From ${formatDate(o.startsAt)}` : "Running";
  return `${from} · ${o.endsAt ? `ends ${formatDate(o.endsAt)}` : "no end date"}`;
}
