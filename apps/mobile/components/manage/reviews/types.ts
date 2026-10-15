export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ModerationReview {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerified: boolean;
  status: ReviewStatus;
  createdAt: string;
  user: { id: string; name: string };
  product: { id: string; name: string; imageUrl: string | null };
  images: { id: string; imageUrl: string }[];
  reply: { body: string; user: { name: string } } | null;
}

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  APPROVED: { label: "Approved", color: "#15803d", bg: "#dcfce7" },
  REJECTED: { label: "Rejected", color: "#b91c1c", bg: "#fee2e2" },
};

export interface StoreRatingRecord {
  id: string;
  overallRating: number;
  deliveryRating: number | null;
  packagingRating: number | null;
  comment: string | null;
  createdAt: string;
  user: { id: string; name: string };
  store: { id: string; name: string };
}

export interface StoreRatingSummary {
  count: number;
  overall: number;
  delivery: number;
  packaging: number;
}

export interface RatedProduct {
  productId: string;
  name: string;
  imageUrl: string | null;
  avgRating: number;
  reviewCount: number;
}

export interface ReviewAnalyticsData {
  kpis: { totalReviews: number; avgRating: number; pendingModeration: number; responseRate: number };
  distribution: Record<number, number>;
  volume: { date: string; count: number }[];
  topRated: RatedProduct[];
  worstRated: RatedProduct[];
  storeRatingSummary: StoreRatingSummary;
}
