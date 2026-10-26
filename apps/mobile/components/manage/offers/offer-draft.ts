import type { StoreOfferKind } from "@martly/shared/types";
import { draftOffer, endIso, startIso, type DiscountDraft, type OfferDraft } from "../inventory/draft";
import type { PickedListing } from "./ListingPickerSheet";

export type NewOfferDraft = OfferDraft & DiscountDraft & { kind: StoreOfferKind; memberPercent: string };

export const EMPTY_OFFER: NewOfferDraft = {
  kind: "BUY_GET", offerMode: "B2G1", offerBuy: "2", offerGet: "1", offerStart: null, offerEnd: null,
  discountMode: "PERCENTAGE", discountValue: "", discountStart: null, discountEnd: null, memberPercent: "",
};

function discountBody(d: NewOfferDraft, picked: PickedListing[]): Record<string, unknown> | string {
  if (d.discountMode === "NONE") return "Pick Flat ₹ or Percent %";
  const value = Number(d.discountValue);
  if (!(value > 0)) return "Enter the discount";
  if (d.discountMode === "PERCENTAGE" && value > 100) return "Percentage can't exceed 100";
  const cheapest = picked.reduce((low, p) => (p.price < low.price ? p : low), picked[0]);
  if (d.discountMode === "FLAT" && value >= cheapest.price) return `The discount must be below ${cheapest.name} ${cheapest.size}'s price`;
  return { discountType: d.discountMode, discountValue: value, startsAt: startIso(d.discountStart), endsAt: endIso(d.discountEnd) };
}

/** The POST /offers body for the draft, or what to fix first */
export function offerBody(d: NewOfferDraft, storeId: string, picked: PickedListing[]): Record<string, unknown> | string {
  if (picked.length === 0) return "Pick at least one product";
  const base = { kind: d.kind, storeId, storeProductIds: picked.map((p) => p.id) };
  if (d.kind === "MEMBER_PRICE") {
    const percentOff = Number(d.memberPercent);
    if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 90) return "Enter a whole % from 1 to 90";
    return { ...base, percentOff };
  }
  if (d.kind === "DISCOUNT") {
    const discount = discountBody(d, picked);
    return typeof discount === "string" ? discount : { ...base, ...discount };
  }
  const offer = draftOffer(d);
  if (!offer) return d.offerMode === "NONE" ? "Pick 1 + 1, 2 + 1 or Custom" : "Quantities must be whole numbers from 1 to 10";
  return { ...base, buy: offer.buy, get: offer.get, startsAt: startIso(d.offerStart), endsAt: endIso(d.offerEnd) };
}
