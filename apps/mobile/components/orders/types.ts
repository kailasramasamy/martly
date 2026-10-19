import type { ReturnStateLine } from "../order/ReturnStateLine";
import type { StoreProduct } from "../../lib/types";

export interface OrderSummaryItem {
  id: string;
  quantity: number;
  product: { name: string; imageUrl: string | null };
  variant: { name: string; imageUrl?: string | null };
}

export interface OrderSummary {
  id: string;
  status: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  totalAmount: string;
  createdAt: string;
  estimatedDeliveryAt: string | null;
  scheduledDate: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  items: OrderSummaryItem[];
  store: { id: string; name: string };
  deliveryTrip: { rider: { name: string; phone: string | null } | null } | null;
  storeRatings: { id: string }[];
  returnRequest: Parameters<typeof ReturnStateLine>[0]["request"] | null;
}

export type OrderFilter = "ALL" | "ACTIVE" | "DELIVERED" | "CANCELLED";

export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

export const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED"];

export interface ReorderItems {
  store: { id: string; name: string };
  items: { storeProduct: StoreProduct; quantity: number }[];
  unavailable: { productName: string; variantName: string }[];
}
