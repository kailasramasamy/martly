import type { DeliveryFailureReason } from "@martly/shared/constants";

export interface PlanSettings {
  maxOrdersPerTrip: number;
  maxTripsPerRider: number;
  expressBatchSize: number;
  expressMaxWaitMinutes: number;
  autoPlan: boolean;
}

export interface PlanRider {
  id: string;
  name: string;
  phone: string | null;
}

export interface DeliveryFailure {
  reason: DeliveryFailureReason;
  note: string | null;
  createdAt: string;
}

export interface Stop {
  id: string;
  status: string;
  deliverySequence: number | null;
  totalAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  createdAt: string;
  user: { name: string; phone: string | null };
  _count: { items: number };
  deliveryFailures?: DeliveryFailure[];
}

export interface PlanTrip {
  id: string;
  status: "PLANNED" | "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  plannedDistanceM: number | null;
  plannedDurationS: number | null;
  areaLabel: string | null;
  riderId: string | null;
  rider: PlanRider | null;
  stops: Stop[];
  packed: number;
  suggestedRiderId: string | null;
}

export interface Wave {
  kind: "EXPRESS" | "SLOT";
  slotId: string | null;
  label: string;
  startTime?: string;
  endTime?: string;
  cutoffAt?: string;
  booked?: number;
  capacity?: number;
  roster?: PlanRider[];
  pool: Stop[];
  trips: PlanTrip[];
}

export interface DeliveryPlan {
  date: string;
  isToday: boolean;
  settings: PlanSettings;
  riders: (PlanRider & { email: string | null; role: string })[];
  waves: Wave[];
}

export const waveKey = (w: Wave) => (w.kind === "EXPRESS" ? "express" : (w.slotId as string));

/** The wave running now, else the next one to start, else the last of the day */
export function defaultWaveKey(plan: DeliveryPlan): string | null {
  const slots = plan.waves.filter((w) => w.kind === "SLOT");
  if (slots.length === 0) return plan.waves[0] ? waveKey(plan.waves[0]) : null;
  if (!plan.isToday) return waveKey(slots[0]);
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const current = slots.find((w) => (w.endTime ?? "") > hhmm) ?? slots[slots.length - 1];
  return waveKey(current);
}

export const isUnstarted = (t: PlanTrip) => t.status === "PLANNED" || t.status === "CREATED";

export const TRIP_GROUPS: { key: string; title: string; statuses: PlanTrip["status"][] }[] = [
  { key: "planned", title: "Planned", statuses: ["PLANNED"] },
  { key: "assigned", title: "Assigned", statuses: ["CREATED"] },
  { key: "road", title: "On the road", statuses: ["IN_PROGRESS"] },
  { key: "done", title: "Done", statuses: ["COMPLETED", "CANCELLED"] },
];

export function startBlocker(trip: PlanTrip): string | null {
  if (!trip.riderId) return "Assign a rider first";
  if (trip.packed < trip.stops.length) return `${trip.packed} of ${trip.stops.length} orders packed`;
  return null;
}

export function formatTripMetrics(trip: PlanTrip): string {
  const parts = [`${trip.stops.length} stop${trip.stops.length === 1 ? "" : "s"}`];
  if (trip.plannedDistanceM != null) parts.push(`${(trip.plannedDistanceM / 1000).toFixed(1)} km`);
  if (trip.plannedDurationS != null) parts.push(`${Math.round(trip.plannedDurationS / 60)} min`);
  return parts.join(" · ");
}

export interface TripHandlers {
  onAssign: (tripId: string, riderId: string) => void;
  onStart: (tripId: string) => void;
  onCancel: (tripId: string) => void;
  onMove: (tripId: string, orderId: string, toTripId: string | null) => void;
  onDeliver: (orderId: string) => void;
  onFail: (tripId: string, orderId: string, reason: DeliveryFailureReason, note: string) => Promise<boolean>;
}
