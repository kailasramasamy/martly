import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { OrderData } from "./types";

export interface StoreRatingData {
  id: string;
  overallRating: number;
  deliveryRating: number | null;
  packagingRating: number | null;
  comment: string | null;
}

export interface MyReviewData {
  id: string;
  productId: string;
  rating: number;
  status: string;
}

export interface RatingDraft {
  overall: number;
  delivery: number;
  packaging: number;
  comment: string;
}

const EMPTY: RatingDraft = { overall: 0, delivery: 0, packaging: 0, comment: "" };

/** The shopper's store rating and product reviews for a delivered order, and submitting the store rating */
export function useOrderRatings(order: OrderData | null) {
  const toast = useToast();
  const t = useStrings("orders").detail;
  const [storeRating, setStoreRating] = useState<StoreRatingData | null>(null);
  const [reviews, setReviews] = useState<MyReviewData[]>([]);
  const [draft, setDraft] = useState<RatingDraft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const delivered = order?.status === "DELIVERED";
  const productIds = order?.items.map((i) => i.productId).join(",") ?? "";

  useEffect(() => {
    if (!delivered || !order) return;
    api.get<StoreRatingData>(`/api/v1/store-ratings/order/${order.id}`).then((res) => { if (res.data) setStoreRating(res.data); }).catch(() => {});
    if (productIds) api.get<MyReviewData[]>(`/api/v1/reviews/my-reviews?productIds=${productIds}`).then((res) => { if (res.data) setReviews(res.data); }).catch(() => {});
  }, [delivered, order?.id, productIds]);

  const submit = useCallback(async () => {
    if (!order || draft.overall === 0) return false;
    setSubmitting(true);
    try {
      const res = await api.post<StoreRatingData>("/api/v1/store-ratings", {
        orderId: order.id, storeId: order.storeId, overallRating: draft.overall,
        deliveryRating: draft.delivery || undefined, packagingRating: draft.packaging || undefined, comment: draft.comment.trim() || undefined,
      });
      setStoreRating(res.data);
      toast.show(t.thanksFeedback, "success");
      return true;
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : t.ratingFailed, "error");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [order, draft, toast, t]);

  return { storeRating, reviews, draft, setDraft, submitting, submit };
}
