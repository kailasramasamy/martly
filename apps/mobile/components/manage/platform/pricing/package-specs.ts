import { BRAND_PRODUCT_KINDS, type AdProductKind } from "@martly/shared/constants";
import type { AdProduct } from "./types";

export type NumKey = "price" | "yearlyPrice" | "durationDays" | "promotionCredits" | "aiImagesPerMonth" | "aiImageCredits" | "sortOrder" | "viewsPerUnit";

export interface NumSpec { key: NumKey; label: string; money?: boolean; min: number; max: number; nullable?: boolean }

/** Which fields a package kind edits; limits mirror adProductSchema */
export interface KindSpec { named: boolean; push?: boolean; numbers: NumSpec[] }

const PRICE: NumSpec = { key: "price", label: "Price", money: true, min: 0, max: 10_000_000 };

const STORE_PLAN: KindSpec = {
  named: true,
  push: true,
  numbers: [
    { ...PRICE, label: "Price / month" },
    { key: "yearlyPrice", label: "Price / year (empty = no annual option)", money: true, min: 0, max: 10_000_000, nullable: true },
    { key: "promotionCredits", label: "Promotions / month", min: 0, max: 100 },
    { key: "aiImagesPerMonth", label: "AI images / month", min: 0, max: 10_000 },
  ],
};
const TOPUP: KindSpec = { named: false, numbers: [PRICE, { key: "promotionCredits", label: "Promotions per purchase", min: 1, max: 100 }] };
const IMAGE_PACK: KindSpec = {
  named: true,
  numbers: [PRICE, { key: "aiImageCredits", label: "Images per pack", min: 1, max: 10_000 }, { key: "sortOrder", label: "Sort order", min: 0, max: 999 }],
};
const BRAND: KindSpec = { named: true, numbers: [PRICE, { key: "durationDays", label: "Days", min: 1, max: 365 }] };
const BRAND_CPM: KindSpec = { ...BRAND, numbers: [...BRAND.numbers, { key: "viewsPerUnit", label: "Views per unit", min: 100, max: 1_000_000 }] };

export function specFor(kind: AdProductKind): KindSpec {
  if (kind === "STORE_PLAN") return STORE_PLAN;
  if (kind === "PROMOTION_TOPUP") return TOPUP;
  if (kind === "AI_IMAGE_PACK") return IMAGE_PACK;
  return kind === "BRAND_CPM" ? BRAND_CPM : BRAND;
}

export const isBrandProduct = (p: AdProduct) => BRAND_PRODUCT_KINDS.includes(p.kind);

export type PackageErrors = Partial<Record<NumKey | "name" | "description", string>>;

export function validatePackage(p: AdProduct): PackageErrors {
  const spec = specFor(p.kind);
  const errors: PackageErrors = {};
  if (spec.named) {
    if (p.name.trim().length < 2 || p.name.length > 60) errors.name = "2 to 60 characters";
    if ((p.description ?? "").length > 240) errors.description = "Up to 240 characters";
  }
  for (const n of spec.numbers) {
    const v = p[n.key];
    if (n.nullable && v === null) continue;
    const whole = !n.money;
    if (v === null || !Number.isFinite(v) || v < n.min || v > n.max || (whole && !Number.isInteger(v))) {
      errors[n.key] = `Enter ${whole ? "a whole number" : "an amount"} from ${n.min} to ${n.max.toLocaleString("en-IN")}`;
    }
  }
  return errors;
}
