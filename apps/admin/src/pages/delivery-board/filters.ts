export type ShowFilter = "all" | "ready" | "road" | "pickupReady" | "preparing";
export type PaymentFilter = "any" | "cash" | "paid";

export interface BoardFilters {
  show: ShowFilter;
  area: string | null;
  payment: PaymentFilter;
  riderId: string | null;
}

export const NO_FILTERS: BoardFilters = { show: "all", area: null, payment: "any", riderId: null };

export type BoardSection = "ready" | "trips" | "noRider" | "pipeline" | "pickupReady" | "pickupPreparing" | "completed";

const SECTIONS_BY_SHOW: Record<ShowFilter, BoardSection[] | null> = {
  all: null,
  ready: ["ready"],
  road: ["trips", "noRider"],
  pickupReady: ["pickupReady"],
  preparing: ["pipeline", "pickupPreparing"],
};

export interface FilterableOrder {
  deliveryPincode: string | null;
  paymentMethod: string;
  paymentStatus: string;
}

export const isFiltered = (f: BoardFilters): boolean =>
  f.show !== "all" || f.area !== null || f.payment !== "any" || f.riderId !== null;

export const showSection = (f: BoardFilters, section: BoardSection): boolean =>
  SECTIONS_BY_SHOW[f.show]?.includes(section) ?? true;

export const isCashToCollect = (o: FilterableOrder): boolean => o.paymentMethod === "COD" && o.paymentStatus !== "PAID";

export function filterOrders<T extends FilterableOrder>(orders: T[], f: BoardFilters): T[] {
  return orders.filter((o) => {
    if (f.area !== null && o.deliveryPincode !== f.area) return false;
    if (f.payment === "cash") return isCashToCollect(o);
    if (f.payment === "paid") return o.paymentStatus === "PAID";
    return true;
  });
}

/** Rider filter picks trips; area and payment narrow each trip's stops and drop trips left empty */
export function filterTrips<O extends FilterableOrder, T extends { rider: { id: string }; orders: O[] }>(
  trips: T[],
  f: BoardFilters,
): T[] {
  const narrowed = f.area !== null || f.payment !== "any";
  return trips
    .filter((t) => f.riderId === null || t.rider.id === f.riderId)
    .map((t) => (narrowed ? { ...t, orders: filterOrders(t.orders, f) } : t))
    .filter((t) => !narrowed || t.orders.length > 0);
}

export function areaCounts(orders: FilterableOrder[]): { pincode: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.deliveryPincode) counts.set(o.deliveryPincode, (counts.get(o.deliveryPincode) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([pincode, count]) => ({ pincode, count }));
}

export function tripRiders(trips: { rider: { id: string; name: string } }[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const t of trips) byId.set(t.rider.id, t.rider.name);
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
}
