import type { ReturnLinesGroup } from "../../lib/types";
import type { OrderLine } from "./OrderItemRow";

export interface OrderItemData extends OrderLine {
  productId: string;
}

export interface StatusLogData {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface OrderData {
  id: string;
  storeId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType?: "DELIVERY" | "PICKUP";
  totalAmount: string;
  deliveryAddress: string | null;
  deliveryTripId?: string | null;
  deliveryTrip?: { id: string; status: string; rider: { name: string | null; phone: string | null } | null } | null;
  estimatedDeliveryAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemData[];
  statusLogs?: StatusLogData[];
  couponCode?: string | null;
  couponDiscount?: string | null;
  creditDiscount?: string | number | null;
  deliveryFee?: string | null;
  deliveryNotes?: string | null;
  walletAmountUsed?: string | null;
  loyaltyPointsUsed?: number | null;
  loyaltyPointsEarned?: number | null;
  refusedAmount?: string | null;
  pickups?: ReturnLinesGroup[];
  scheduledDate?: string | null;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
}
