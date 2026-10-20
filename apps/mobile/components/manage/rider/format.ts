import { DELIVERY_FAILURE_LABELS } from "@martly/shared/constants";
import type { OrderPickup } from "../orders/types";
import type { RiderFailure, RiderStop, RiderTrip, TripRoute } from "./types";
import { formatINR } from "../ui/tokens";

const IST = "Asia/Kolkata";

export const hhmm = (time: string) => time.slice(0, 5);

export function clockTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "Evening 17:00–19:00" for a slot trip, "Express" otherwise */
export function waveLabel(trip: RiderTrip): string {
  if (!trip.deliverySlot) return "Express";
  const start = hhmm(trip.deliverySlot.startTime);
  const hour = Number(start.slice(0, 2));
  const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return `${period} ${start}–${hhmm(trip.deliverySlot.endTime)}`;
}

export function minutesText(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** "~35 min left · back by 18:25" */
export function finishText(route: TripRoute, now = new Date()): string {
  return `${minutesText(route.totalSeconds)} left · back by ${clockTime(new Date(now.getTime() + route.totalSeconds * 1000))}`;
}

export function etaFor(route: TripRoute | null, orderId: string): number | null {
  return route?.stops.find((s) => s.orderId === orderId)?.etaSeconds ?? null;
}

export function stopWindow(stop: RiderStop): string | null {
  return stop.slotStartTime && stop.slotEndTime ? `${hhmm(stop.slotStartTime)}–${hhmm(stop.slotEndTime)}` : null;
}

export function navigateUrl(stop: RiderStop): string | null {
  const destination = stop.deliveryLat !== null && stop.deliveryLng !== null ? `${stop.deliveryLat},${stop.deliveryLng}` : stop.deliveryAddress;
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null;
}

export function failureText(failure: Pick<RiderFailure, "reason" | "note">): string {
  return failure.reason === "OTHER" && failure.note ? failure.note : DELIVERY_FAILURE_LABELS[failure.reason];
}

export const isDelivered = (stop: RiderStop) => stop.status === "DELIVERED";

export function tripCash(trip: RiderTrip): number {
  return trip.orders.filter((s) => !isDelivered(s)).reduce((sum, s) => sum + s.amountDue, 0);
}

/** "Delivered 18:12 · ₹673 by UPI" for a finished stop, on the rider's list and the dispatch board */
export function deliveredText(stop: { deliveredAt: string | null; codCollectedVia: "CASH" | "UPI" | null; amountCollected: number }): string {
  const at = stop.deliveredAt ? `Delivered ${clockTime(stop.deliveredAt)}` : "Delivered";
  return stop.codCollectedVia ? `${at} · ${formatINR(stop.amountCollected)} by ${stop.codCollectedVia === "UPI" ? "UPI" : "cash"}` : at;
}

/** "1 × Fortune Oil 1 L, 2 × Parle-G 800 g" for the items a rider collects back */
export function pickupText(pickups: OrderPickup[]): string {
  return pickups.flatMap((p) => p.items.map((i) => `${i.quantity} × ${i.orderItem.product.name} ${i.orderItem.variant.name}`)).join(", ");
}

/** The short order number customers and staff quote, e.g. #310E2D69 */
export const orderRef = (orderId: string) => `#${orderId.slice(0, 8).toUpperCase()}`;

/** Cash the rider hands to the customer when collecting this return; 0 when the refund goes elsewhere */
export const cashHandBack = (p: OrderPickup): number => (p.refundTo === "CASH" && p.remedy === "REFUND" ? Number(p.approvedAmount ?? 0) : 0);
