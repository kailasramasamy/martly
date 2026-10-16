import type { OrderDetailItem } from "../orders/types";
import type { DaySummary } from "../rider/types";

export interface TripStats {
  total: number;
  active: number;
  completed: number;
}

export interface Rider {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  createdAt: string;
  tripStats: TripStats;
  today: DaySummary | null;
}

export interface RiderOption {
  id: string;
  name: string;
  phone: string | null;
  email: string;
}

/** What the order menu needs: board rows and trip stops both carry it */
export interface MenuOrder {
  id: string;
  storeId: string;
  status: string;
  totalAmount: string;
  paymentMethod?: string;
  paymentStatus?: string;
  walletAmountUsed?: string | null;
  loyaltyPointsUsed?: number | null;
  fulfillmentType: "DELIVERY" | "PICKUP";
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  deliveryTripId: string | null;
  user: { id: string; name: string; phone: string | null };
  items: OrderDetailItem[];
}

export interface BoardOrder extends MenuOrder {
  deliverySlotId: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  createdAt: string;
  deliveryTrip: { id: string; status: string; rider: { id: string; name: string; phone: string | null } } | null;
}

export interface SlotGroup {
  slotId: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  orders: BoardOrder[];
}

export interface BoardData {
  date: string;
  express: BoardOrder[];
  scheduled: Record<string, SlotGroup>;
  pickup: BoardOrder[];
}

export interface Trip {
  id: string;
  status: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  startedAt: string | null;
  createdAt: string;
  rider: { id: string; name: string; phone: string | null };
  orders: MenuOrder[];
}
