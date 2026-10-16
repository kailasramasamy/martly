import type { DeliveryFailureReason } from "@martly/shared/constants";

export type TripPhase = "PLANNED" | "CREATED" | "IN_PROGRESS" | "COMPLETED";

export interface PlanStop {
  id: string;
  status: string;
  deliverySequence: number | null;
  totalAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  createdAt: string;
  user: { name: string; phone: string | null };
  _count: { items: number };
  codCollectedVia: "CASH" | "UPI" | null;
  /** COD taken at the door, once delivered */
  amountCollected: number;
  deliveredAt: string | null;
  /** Latest failed attempt first; at most one */
  deliveryFailures?: { reason: DeliveryFailureReason; note: string | null; createdAt: string }[];
}

export interface PlanRider {
  id: string;
  name: string;
  phone: string | null;
}

export interface PlanTrip {
  id: string;
  status: TripPhase;
  plannedDistanceM: number | null;
  plannedDurationS: number | null;
  areaLabel: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rider: PlanRider | null;
  riderId: string | null;
  stops: PlanStop[];
  /** Stops that are READY or beyond */
  packed: number;
  /** The rider's last shared position, only while on the road */
  live: { lat: number; lng: number; updatedAt: string } | null;
  /** Only for PLANNED trips */
  suggestedRiderId: string | null;
}

export interface PlanWave {
  kind: "EXPRESS" | "SLOT";
  slotId: string | null;
  label: string;
  startTime?: string;
  endTime?: string;
  cutoffAt?: string;
  booked?: number;
  capacity?: number;
  roster?: PlanRider[];
  pool: PlanStop[];
  trips: PlanTrip[];
}

export interface FleetSettings {
  maxOrdersPerTrip: number;
  maxTripsPerRider: number;
  expressBatchSize: number;
  expressMaxWaitMinutes: number;
  autoPlan: boolean;
}

export interface DeliveryPlan {
  date: string;
  isToday: boolean;
  settings: FleetSettings;
  riders: (PlanRider & { email: string; role: string })[];
  waves: PlanWave[];
}

export interface PlanResult {
  tripIds: string[];
  overflow: number;
  plan: DeliveryPlan;
}
