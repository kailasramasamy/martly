import { useState } from "react";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import type { OrderDetail } from "../../orders/types";
import type { MenuOrder } from "../types";
import type { PlanStop, PlanTrip } from "./types";

export type PlanSheet =
  | { kind: "rider"; tripId: string }
  | { kind: "move"; tripId: string; orderId: string }
  | { kind: "fail"; tripId: string; orderId: string; customer: string }
  | { kind: "roster" };

const toMenuOrder = (o: OrderDetail & { deliveryPincode?: string | null }, tripId: string | null): MenuOrder => ({
  id: o.id,
  storeId: o.storeId,
  status: o.status,
  totalAmount: o.totalAmount,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  walletAmountUsed: o.walletAmountUsed,
  loyaltyPointsUsed: o.loyaltyPointsUsed,
  fulfillmentType: o.fulfillmentType === "PICKUP" ? "PICKUP" : "DELIVERY",
  deliveryAddress: o.deliveryAddress,
  deliveryPincode: o.deliveryPincode ?? null,
  deliveryTripId: tripId,
  user: { id: o.user.id, name: o.user.name, phone: o.user.phone },
  items: o.items,
});

/** One floating sheet at a time (iOS can't stack them): rider picker, move picker, roster, or an order's menu */
export function usePlanSheets() {
  const { run } = useAction();
  const [sheet, setSheet] = useState<PlanSheet | null>(null);
  const [menuOrder, setMenuOrder] = useState<MenuOrder | null>(null);

  const open = (next: PlanSheet) => {
    setMenuOrder(null);
    setSheet(next);
  };
  const openStop = async (stop: PlanStop, tripId: string | null) => {
    setSheet(null);
    const res = await run(() => api.get<OrderDetail>(`/api/v1/orders/${stop.id}`));
    if (res) setMenuOrder(toMenuOrder({ ...res.data, deliveryPincode: stop.deliveryPincode }, tripId));
  };

  return {
    sheet, menuOrder, openStop,
    closeSheet: () => setSheet(null),
    closeMenu: () => setMenuOrder(null),
    pickRider: (trip: PlanTrip) => open({ kind: "rider", tripId: trip.id }),
    pickMove: (trip: PlanTrip, stop: PlanStop) => open({ kind: "move", tripId: trip.id, orderId: stop.id }),
    pickFail: (trip: PlanTrip, stop: PlanStop) => open({ kind: "fail", tripId: trip.id, orderId: stop.id, customer: stop.user.name }),
    openRoster: () => open({ kind: "roster" }),
  };
}

export type PlanSheets = ReturnType<typeof usePlanSheets>;
