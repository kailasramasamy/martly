import type { DiscountType } from "../constants/index.js";

export type StoreOfferKind = "BUY_GET" | "DISCOUNT" | "MEMBER_PRICE";
export type StoreOfferStatus = "live" | "scheduled" | "ended";

/** One offer on one store listing; a listing with both a discount and a buy X get Y shows as two */
export interface StoreOffer {
  /** `${kind}:${storeProductId}` */
  id: string;
  kind: StoreOfferKind;
  storeProductId: string;
  productName: string;
  imageUrl: string | null;
  variantName: string;
  price: number;
  buy: number | null;
  get: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  memberPrice: number | null;
  startsAt: string | null;
  endsAt: string | null;
}
