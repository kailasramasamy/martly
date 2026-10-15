import { fromDateKey, toDateKey } from "../ui/dates";
import type { DiscountType, StoreProductItem } from "./types";

export type DiscountMode = "NONE" | DiscountType;

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
  };
}

export type DraftResult = { payload: Record<string, unknown> } | { error: string };

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
    discountStart: d.discountStart ? fromDateKey(d.discountStart).toISOString() : null,
    discountEnd: d.discountEnd ? new Date(fromDateKey(d.discountEnd).setHours(23, 59, 59, 999)).toISOString() : null,
  };
}

/** Validate the draft and build the PUT /store-products/:id body */
export function buildUpdatePayload(d: StoreProductDraft): DraftResult {
  const price = Number(d.price);
  const stock = Number(d.stock);
  if (!(price > 0)) return { error: "Enter a price above zero" };
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a whole number" };
  if (d.memberPrice && !(Number(d.memberPrice) > 0)) return { error: "Member price must be above zero" };
  const discount = discountPayload(d, price);
  if (typeof discount === "string") return { error: discount };
  return {
    payload: {
      price,
      stock,
      isActive: d.isActive,
      isFeatured: d.isFeatured,
      memberPrice: d.memberPrice ? Number(d.memberPrice) : null,
      ...discount,
    },
  };
}
