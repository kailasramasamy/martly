import type { Decimal } from "../../generated/prisma/runtime/library.js";

interface DiscountFields {
  discountType: string | null;
  discountValue: Decimal | number | null;
  discountStart: Date | null;
  discountEnd: Date | null;
}

export interface PricingResult {
  effectivePrice: number;
  originalPrice: number;
  discountType: string | null;
  discountValue: number | null;
  discountActive: boolean;
  savingsAmount: number;
  savingsPercent: number;
}

export function isDiscountActive(discount: DiscountFields, now: Date = new Date()): boolean {
  if (!discount.discountType || discount.discountValue == null || Number(discount.discountValue) <= 0) {
    return false;
  }
  if (discount.discountStart && now < discount.discountStart) return false;
  if (discount.discountEnd && now > discount.discountEnd) return false;
  return true;
}

export function applyDiscount(basePrice: number, discount: DiscountFields): number {
  const value = Number(discount.discountValue);
  if (discount.discountType === "FLAT") {
    return Math.max(0, basePrice - value);
  }
  if (discount.discountType === "PERCENTAGE") {
    return Math.max(0, basePrice * (1 - value / 100));
  }
  return basePrice;
}

export function calculateEffectivePrice(
  storePrice: number | Decimal,
  variantDiscount: DiscountFields | null,
  storeDiscount: DiscountFields | null,
): PricingResult {
  const basePrice = Number(storePrice);
  const now = new Date();

  // Store discount takes priority over variant discount
  let activeDiscount: DiscountFields | null = null;
  if (storeDiscount && isDiscountActive(storeDiscount, now)) {
    activeDiscount = storeDiscount;
  } else if (variantDiscount && isDiscountActive(variantDiscount, now)) {
    activeDiscount = variantDiscount;
  }

  if (!activeDiscount) {
    return {
      effectivePrice: basePrice,
      originalPrice: basePrice,
      discountType: null,
      discountValue: null,
      discountActive: false,
      savingsAmount: 0,
      savingsPercent: 0,
    };
  }

  const effectivePrice = Math.round(applyDiscount(basePrice, activeDiscount) * 100) / 100;
  const savingsAmount = Math.round((basePrice - effectivePrice) * 100) / 100;
  const savingsPercent = basePrice > 0 ? Math.round((savingsAmount / basePrice) * 10000) / 100 : 0;

  return {
    effectivePrice,
    originalPrice: basePrice,
    discountType: activeDiscount.discountType,
    discountValue: Number(activeDiscount.discountValue),
    discountActive: true,
    savingsAmount,
    savingsPercent,
  };
}
