import type { ReturnStateLine } from "../order/ReturnStateLine";
import type { StoreLabel, StoreProduct, Translations } from "../../lib/types";

export interface OrderSummaryItem {
  id: string;
  quantity: number;
  product: { name: string; imageUrl: string | null; translations?: Translations | null };
  variant: { name: string; imageUrl?: string | null };
}

export interface OrderSummary {
  id: string;
  status: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  totalAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  walletAmountUsed: string | null;
  loyaltyPointsUsed: number | null;
  createdAt: string;
  estimatedDeliveryAt: string | null;
  scheduledDate: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  items: OrderSummaryItem[];
  store: StoreLabel;
  deliveryTrip: { rider: { name: string; phone: string | null } | null } | null;
  storeRatings: { id: string }[];
  returnRequest: Parameters<typeof ReturnStateLine>[0]["request"] | null;
}

export type OrderFilter = "ALL" | "ACTIVE" | "DELIVERED" | "CANCELLED";

export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

export interface ReorderItems {
  store: StoreLabel;
  items: { storeProduct: StoreProduct; quantity: number }[];
  unavailable: { productName: string; variantName: string }[];
}
