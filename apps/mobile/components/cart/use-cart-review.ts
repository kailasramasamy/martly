import { useEffect, useMemo, useState } from "react";
import { useCart } from "../../lib/cart-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { api } from "../../lib/api";
import type { CartReview, StoreProduct } from "../../lib/types";

const REFETCH_DELAY_MS = 300;

export interface LineStatus {
  /** Gone from the store or out of stock: the line has to be removed before checkout */
  unavailable: boolean;
  /** Units left when fewer than the cart holds (or exactly as many), so + stops there */
  stockLeft: number | null;
  /** The price the line had before the store changed it */
  previousPrice: number | null;
}

// What the shopper would pay without the store's offer: the pre-discount price, else the MRP when it's higher
function listPrice(sp: StoreProduct) {
  if (sp.pricing?.discountActive) return sp.pricing.originalPrice;
  return Math.max(Number(sp.variant.mrp ?? 0), Number(sp.price));
}

// Asks the store about the cart's lines (debounced) whenever they or the gap change, plus "also bought" for the rail
function useReviewFetch(gapKey: number | null) {
  const { storeId, items } = useCart();
  // With the lines it was asked about, so a line added since isn't taken for one the store dropped
  const [review, setReview] = useState<(CartReview & { asked: Set<string> }) | null>(null);
  const [alsoBought, setAlsoBought] = useState<StoreProduct[]>([]);
  const ids = items.map((i) => i.storeProductId).join(",");
  const productIds = [...new Set(items.map((i) => i.productId))].join(",");

  useEffect(() => {
    if (!storeId || !ids) {
      setReview(null);
      setAlsoBought([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      const asked = ids.split(",");
      api.post<CartReview>("/api/v1/cart/review", { storeId, storeProductIds: asked, gap: gapKey ?? undefined })
        .then((res) => live && setReview({ ...res.data, asked: new Set(asked) }))
        .catch(() => {});
      api.get<StoreProduct[]>(`/api/v1/stores/${storeId}/frequently-bought-together?productIds=${productIds}&exclude=${ids}&limit=6`)
        .then((res) => live && setAlsoBought(res.data))
        .catch(() => {});
    }, REFETCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [storeId, ids, productIds, gapKey]);

  return { review, alsoBought };
}

// Moves lines to the store's current price and remembers what they were, for the "Price changed" note
function useRepricing(byId: Map<string, StoreProduct>) {
  const { items, repriceItems } = useCart();
  const { isMember } = useMembership();
  const [previousPrices, setPreviousPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const changed = new Map<string, number>();
    for (const item of items) {
      const sp = byId.get(item.storeProductId);
      if (sp && Math.abs(getBestPrice(sp, isMember) - item.price) >= 0.01) changed.set(item.storeProductId, getBestPrice(sp, isMember));
    }
    if (changed.size === 0) return;
    setPreviousPrices((prev) => {
      const next = new Map(prev);
      for (const item of items) if (changed.has(item.storeProductId) && !next.has(item.storeProductId)) next.set(item.storeProductId, item.price);
      return next;
    });
    repriceItems(changed);
  }, [byId, items, isMember, repriceItems]);

  return previousPrices;
}

/**
 * Re-checks the cart with the store whenever its lines change: reprices stale lines, flags stock
 * problems, totals the savings, and brings the suggestions shown under the items.
 */
export function useCartReview(gap: number | null) {
  const { items } = useCart();
  // Whole rupees, so a price refresh that moves the gap by paise doesn't refetch
  const gapKey = gap != null && gap > 0 ? Math.ceil(gap) : null;
  const { review, alsoBought } = useReviewFetch(gapKey);
  const byId = useMemo(() => new Map((review?.lines ?? []).map((sp) => [sp.id, sp])), [review]);
  const previousPrices = useRepricing(byId);

  const statusOf = (storeProductId: string, quantity: number, price: number): LineStatus => {
    const sp = byId.get(storeProductId);
    const previous = previousPrices.get(storeProductId);
    return {
      unavailable: sp ? sp.availableStock <= 0 : review?.asked.has(storeProductId) === true,
      stockLeft: sp && sp.availableStock > 0 && sp.availableStock <= quantity ? sp.availableStock : null,
      previousPrice: previous != null && Math.abs(previous - price) >= 0.01 ? previous : null,
    };
  };

  const savings = items.reduce((sum, item) => {
    const sp = byId.get(item.storeProductId);
    return sp ? sum + Math.max(0, listPrice(sp) - item.price) * item.quantity : sum;
  }, 0);

  return {
    statusOf,
    savings,
    hasUnavailable: items.some((i) => statusOf(i.storeProductId, i.quantity, i.price).unavailable),
    forgotten: review?.forgotten ?? [],
    gapFillers: gapKey ? review?.gapFillers ?? [] : [],
    alsoBought,
  };
}
