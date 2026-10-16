import type { SelectOption } from "../ui/OptionSheet";
import { allBoardOrders } from "./groups";
import type { BoardData, BoardOrder, Trip, MenuOrder } from "./types";

export type DeliveryView = "" | "ready" | "road" | "pickup" | "preparing";

export interface DeliveryFilters {
  view: DeliveryView;
  pincode: string;
  payment: "" | "cash" | "paid";
  riderId: string;
}

export const NO_DELIVERY_FILTERS: DeliveryFilters = { view: "", pincode: "", payment: "", riderId: "" };

export const VIEW_OPTIONS: SelectOption[] = [
  { value: "", label: "Everything" },
  { value: "ready", label: "Ready to dispatch" },
  { value: "road", label: "On the road" },
  { value: "pickup", label: "Ready for pickup" },
  { value: "preparing", label: "Still preparing" },
];

export const PAYMENT_OPTIONS: SelectOption[] = [
  { value: "", label: "Any payment" },
  { value: "cash", label: "Cash to collect" },
  { value: "paid", label: "Paid" },
];

type Payable = Pick<MenuOrder, "paymentMethod" | "paymentStatus">;
const cashDue = (o: Payable) => o.paymentMethod === "COD" && o.paymentStatus !== "PAID";

function matches(o: MenuOrder, f: DeliveryFilters): boolean {
  if (f.pincode && o.deliveryPincode !== f.pincode) return false;
  if (f.payment === "cash" && !cashDue(o)) return false;
  if (f.payment === "paid" && cashDue(o)) return false;
  return true;
}

/** The board and trips narrowed to the area, payment and rider picked (the view filter picks sections) */
export function applyDeliveryFilters(board: BoardData, trips: Trip[], f: DeliveryFilters): { board: BoardData; trips: Trip[] } {
  const keep = (orders: BoardOrder[]) => orders.filter((o) => matches(o, f));
  const scheduled = Object.fromEntries(Object.entries(board.scheduled).map(([k, slot]) => [k, { ...slot, orders: keep(slot.orders) }]));
  const filteredTrips = trips
    .filter((t) => !f.riderId || t.rider.id === f.riderId)
    .map((t) => ({ ...t, orders: t.orders.filter((o) => matches(o, f)) }))
    .filter((t) => t.orders.length > 0);
  return { board: { ...board, express: keep(board.express), scheduled, pickup: keep(board.pickup) }, trips: filteredTrips };
}

/** Pincodes on the board, busiest first, as picker options */
export function pincodeOptions(board: BoardData | null): SelectOption[] {
  const counts = new Map<string, number>();
  for (const o of board ? allBoardOrders(board) : []) {
    if (o.deliveryPincode) counts.set(o.deliveryPincode, (counts.get(o.deliveryPincode) ?? 0) + 1);
  }
  const options = [...counts].sort((a, b) => b[1] - a[1]).map(([pin, count]) => ({ value: pin, label: pin, count }));
  return [{ value: "", label: "All areas" }, ...options];
}

/** Riders with trips on the board */
export function riderOptions(trips: Trip[]): SelectOption[] {
  const riders = new Map(trips.map((t) => [t.rider.id, t.rider.name]));
  return [{ value: "", label: "All riders" }, ...[...riders].map(([id, name]) => ({ value: id, label: name }))];
}

export function activeDeliveryFilterCount(f: DeliveryFilters): number {
  return [f.view, f.pincode, f.payment, f.riderId].filter(Boolean).length;
}
