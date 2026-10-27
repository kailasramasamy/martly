/** Category page filters on martlyshop.in: the "% off or more" and "★ & up" choices, highest first */
export const DISCOUNT_TIERS = [60, 40, 25, 10] as const;
export const RATING_TIERS = [4, 3] as const;

/** A price range in rupees as the URL carries it: "50-100", "500-" (and up), "-50" (under) */
export interface PriceRange {
  min: number | null;
  max: number | null;
}

export function parsePriceRange(value: string | undefined): PriceRange | null {
  const m = value?.match(/^(\d{0,6})-(\d{0,6})$/);
  if (!m || (!m[1] && !m[2])) return null;
  const min = m[1] ? Number(m[1]) : null;
  const max = m[2] ? Number(m[2]) : null;
  return min !== null && max !== null && min > max ? { min: max, max: min } : { min, max };
}

export const formatPriceRange = (r: PriceRange) => `${r.min ?? ""}-${r.max ?? ""}`;
