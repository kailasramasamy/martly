import { useEffect, useState } from "react";
import { api, ApiError } from "../../../../lib/api";
import { toQuery } from "../../../../lib/manage/query";
import type { BrandPackage, SlotCalendar } from "../types";
import { isFeature, isSponsored, isKind } from "./form-state";

/** Sponsored, featured and takeover packages are booked per category */
export const needsCategory = (product?: BrandPackage) =>
  isSponsored(product) || isFeature(product) || isKind(product, "BRAND_TAKEOVER");

interface Params {
  product?: BrandPackage;
  quantity: number;
  categoryId: string | null;
  excludeId?: string;
}

/** Day-by-day start availability for the chosen package, or null when it can't be known yet */
export function useSlotCalendar({ product, quantity, categoryId, excludeId }: Params) {
  const [calendar, setCalendar] = useState<SlotCalendar | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const productId = product?.id;
  const blocked = !productId || !quantity || (needsCategory(product) && !categoryId);

  useEffect(() => {
    setCalendar(null);
    setFailed(false);
    if (blocked) { setLoading(false); return; }
    let current = true;
    setLoading(true);
    const query = toQuery({ productId, quantity, categoryId, excludeId, days: 90 });
    api.get<SlotCalendar>(`/api/v1/brand-campaigns/calendar${query}`)
      .then((res) => current && setCalendar(res.data))
      .catch((err) => {
        if (!(err instanceof ApiError)) throw err;
        if (current) setFailed(true);
      })
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [productId, quantity, categoryId, excludeId, blocked]);
  return { calendar, loading, failed, blocked };
}
