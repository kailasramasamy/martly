import type { DeliveryFailureReason } from "@martly/shared/constants";
import type { OrderDetailItem } from "../orders/types";

export interface DaySummary {
  trips: number;
  tripsDone: number;
  delivered: number;
  failed: number;
  cashCollected: number;
  /** COD paid by UPI straight to the store: not part of the rider's cash */
  upiCollected: number;
  cashToCollect: number;
}

export interface RiderStop {
  id: string;
  status: string;
  deliverySequence: number | null;
  totalAmount: string;
  paymentMethod: string;
  codCollectedVia: "CASH" | "UPI" | null;
  /** COD taken at the door, once delivered (amountDue drops to 0 then) */
  amountCollected: number;
  deliveredAt: string | null;
  paymentStatus: string;
  walletAmountUsed: string | null;
  loyaltyPointsUsed: number | null;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryNotes: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  estimatedDeliveryAt: string | null;
  user: { name: string; phone: string | null };
  items: OrderDetailItem[];
  amountDue: number;
}

export interface RiderFailure {
  orderId: string;
  reason: DeliveryFailureReason;
  note: string | null;
  createdAt: string;
  order: { deliveryAddress: string | null; user: { name: string } };
}

export interface RiderTrip {
  id: string;
  status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
  wave: "SLOT" | "EXPRESS";
  areaLabel: string | null;
  plannedDistanceM: number | null;
  plannedDurationS: number | null;
  startedAt: string | null;
  completedAt: string | null;
  store: { id: string; name: string; address: string | null; phone: string | null; latitude: number | null; longitude: number | null };
  deliverySlot: { startTime: string; endTime: string } | null;
  orders: RiderStop[];
  failures: RiderFailure[];
}

export interface RiderDay {
  date: string;
  summary: DaySummary;
  trips: RiderTrip[];
}

export interface TripRoute {
  from: "rider" | "store";
  stops: { orderId: string; etaSeconds: number; distanceMeters: number }[];
  totalSeconds: number;
  totalMeters: number;
  polyline?: { lat: number; lng: number }[];
}

/** The one sheet or dialog open at a time (iOS can't stack them) */
export type RiderOverlay =
  | { kind: "stop"; tripId: string; stop: RiderStop }
  | { kind: "deliver"; tripId: string; stop: RiderStop }
  | { kind: "fail"; tripId: string; stop: RiderStop };
