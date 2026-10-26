import dayjs from "dayjs";
import type { StoreOffer, StoreOfferKind, StoreOfferStatus } from "@martly/shared/types";

export const OFFER_TABS: { value: StoreOfferStatus; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
];

export const OFFER_KIND_CONFIG: Record<StoreOfferKind, { color: string; label: string }> = {
  BUY_GET: { color: "gold", label: "Buy X get Y" },
  DISCOUNT: { color: "green", label: "Discount" },
  MEMBER_PRICE: { color: "purple", label: "Member price" },
};

export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** "Buy 2 Get 1", "20% off", "₹10 off" or "Members pay ₹112" */
export function offerText(o: StoreOffer): string {
  if (o.kind === "BUY_GET") return `Buy ${o.buy} Get ${o.get}`;
  if (o.kind === "MEMBER_PRICE") return `Members pay ${inr(o.memberPrice!)}`;
  return o.discountType === "PERCENTAGE" ? `${o.discountValue}% off` : `${inr(o.discountValue!)} off`;
}

export function offerDates(o: StoreOffer): string {
  if (o.kind === "MEMBER_PRICE") return "Mart Plus members, always on";
  const fmt = (v: string) => dayjs(v).format("DD MMM YYYY, HH:mm");
  const from = o.startsAt ? `From ${fmt(o.startsAt)}` : "Running";
  return `${from} · ${o.endsAt ? `ends ${fmt(o.endsAt)}` : "no end date"}`;
}
