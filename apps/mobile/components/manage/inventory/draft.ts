import type { MultiBuyOffer } from "@martly/shared/offers";
import { fromDateKey, toDateKey } from "../ui/dates";
import type { DiscountType, StoreProductItem } from "./types";
import type { ListingAccess } from "./use-listing-access";

export type DiscountMode = "NONE" | DiscountType;

export type OfferMode = "NONE" | "B1G1" | "B2G1" | "CUSTOM";

export interface StoreProductDraft {
  stock: string;
  price: string;
  memberPrice: string;
  isActive: boolean;
  isFeatured: boolean;
  discountMode: DiscountMode;
  discountValue: string;
  discountStart: string | null;
  discountEnd: string | null;
  offerMode: OfferMode;
  offerBuy: string;
  offerGet: string;
  offerStart: string | null;
  offerEnd: string | null;
}

function offerModeOf(buy: number | null, get: number | null): OfferMode {
  if (buy === null || get === null) return "NONE";
  if (buy === 1 && get === 1) return "B1G1";
  return buy === 2 && get === 1 ? "B2G1" : "CUSTOM";
}

export function offerLabel(offer: MultiBuyOffer): string {
  return `Buy ${offer.buy} Get ${offer.get}`;
}

/** The offer the draft describes, or null when none is set or the quantities aren't valid yet */
export function draftOffer(d: StoreProductDraft): MultiBuyOffer | null {
  if (d.offerMode === "NONE") return null;
  const buy = Number(d.offerBuy);
  const get = Number(d.offerGet);
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10;
  return valid(buy) && valid(get) ? { buy, get } : null;
}

export function draftFromItem(item: StoreProductItem): StoreProductDraft {
  return {
    stock: String(item.stock),
    price: String(Number(item.price)),
    memberPrice: item.memberPrice ? String(Number(item.memberPrice)) : "",
    isActive: item.isActive,
    isFeatured: item.isFeatured,
    discountMode: item.discountType ?? "NONE",
    discountValue: item.discountValue ? String(Number(item.discountValue)) : "",
    discountStart: item.discountStart ? toDateKey(new Date(item.discountStart)) : null,
    discountEnd: item.discountEnd ? toDateKey(new Date(item.discountEnd)) : null,
    offerMode: offerModeOf(item.offerBuyQty, item.offerGetQty),
    offerBuy: item.offerBuyQty ? String(item.offerBuyQty) : "",
    offerGet: item.offerGetQty ? String(item.offerGetQty) : "",
    offerStart: item.offerStart ? toDateKey(new Date(item.offerStart)) : null,
    offerEnd: item.offerEnd ? toDateKey(new Date(item.offerEnd)) : null,
  };
}

export type DraftResult = { payload: Record<string, unknown> } | { error: string };

const startIso = (key: string | null) => (key ? fromDateKey(key).toISOString() : null);
const endIso = (key: string | null) => (key ? new Date(fromDateKey(key).setHours(23, 59, 59, 999)).toISOString() : null);

function discountPayload(d: StoreProductDraft, price: number): Record<string, unknown> | string {
  if (d.discountMode === "NONE") {
    return { discountType: null, discountValue: null, discountStart: null, discountEnd: null };
  }
  const value = Number(d.discountValue);
  if (!d.discountValue || !(value > 0)) return "Enter a discount value";
  if (d.discountMode === "PERCENTAGE" && value > 100) return "Percentage can't exceed 100";
  if (d.discountMode === "FLAT" && value >= price) return "Flat discount must be below the price";
  return {
    discountType: d.discountMode,
    discountValue: value,
    discountStart: startIso(d.discountStart),
    discountEnd: endIso(d.discountEnd),
  };
}

function offerPayload(d: StoreProductDraft): Record<string, unknown> | string {
  if (d.offerMode === "NONE") return { offerBuyQty: null, offerGetQty: null, offerStart: null, offerEnd: null };
  const offer = draftOffer(d);
  if (!offer) return "Offer quantities must be whole numbers from 1 to 10";
  return { offerBuyQty: offer.buy, offerGetQty: offer.get, offerStart: startIso(d.offerStart), offerEnd: endIso(d.offerEnd) };
}

/** Validate the draft and build the PUT /store-products/:id body, with only the fields the member may change */
export function buildUpdatePayload(d: StoreProductDraft, access: ListingAccess): DraftResult {
  const payload: Record<string, unknown> = {};
  if (access.stock) {
    const stock = Number(d.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a whole number" };
    payload.stock = stock;
  }
  if (access.prices) {
    const price = Number(d.price);
    if (!(price > 0)) return { error: "Enter a price above zero" };
    if (d.memberPrice && !(Number(d.memberPrice) > 0)) return { error: "Member price must be above zero" };
    const discount = discountPayload(d, price);
    if (typeof discount === "string") return { error: discount };
    const offer = offerPayload(d);
    if (typeof offer === "string") return { error: offer };
    Object.assign(payload, { price, memberPrice: d.memberPrice ? Number(d.memberPrice) : null, ...discount, ...offer });
  }
  if (access.listed) payload.isActive = d.isActive;
  if (access.featured) payload.isFeatured = d.isFeatured;
  return { payload };
}
