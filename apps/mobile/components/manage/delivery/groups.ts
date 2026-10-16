import type { BoardData, BoardOrder } from "./types";

export interface OrderGroup {
  key: string;
  label: string;
  orders: BoardOrder[];
}

const PREPARING = new Set(["PENDING", "CONFIRMED", "PREPARING"]);

export function allBoardOrders(board: BoardData): BoardOrder[] {
  return [...board.express, ...Object.values(board.scheduled).flatMap((s) => s.orders), ...board.pickup];
}

const isReadyForDispatch = (o: BoardOrder) => o.fulfillmentType === "DELIVERY" && o.status === "READY" && !o.deliveryTripId;

function groupBy(orders: BoardOrder[], keyOf: (o: BoardOrder) => string, labelOf: (key: string) => string): OrderGroup[] {
  const map = new Map<string, BoardOrder[]>();
  for (const o of orders) map.set(keyOf(o), [...(map.get(keyOf(o)) ?? []), o]);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({ key, label: labelOf(key), orders: list }));
}

/** READY, unassigned delivery orders: express grouped by pincode, scheduled grouped by slot */
export function readyToDispatch(board: BoardData): { express: OrderGroup[]; scheduled: OrderGroup[] } {
  const express = board.express.filter(isReadyForDispatch);
  const scheduled = Object.values(board.scheduled).flatMap((s) => s.orders).filter(isReadyForDispatch);
  return {
    express: groupBy(express, (o) => o.deliveryPincode ?? "", (k) => (k ? `Pincode ${k}` : "No pincode")),
    scheduled: groupBy(scheduled, (o) => `${o.slotStartTime ?? ""}-${o.slotEndTime ?? ""}`, (k) => k.replace("-", " – ")),
  };
}

/** Orders still being confirmed or packed, delivery and pickup alike */
export function stillPreparing(board: BoardData): BoardOrder[] {
  return allBoardOrders(board).filter((o) => PREPARING.has(o.status));
}

/** Packed pickup orders waiting at the counter; no rider needed */
export function pickupsReady(board: BoardData): BoardOrder[] {
  return board.pickup.filter((o) => o.status === "READY");
}

/** Sent out without a trip (moved from the Orders tab), so they're only trackable here */
export function outWithoutTrip(board: BoardData): BoardOrder[] {
  return allBoardOrders(board).filter((o) => o.fulfillmentType === "DELIVERY" && o.status === "OUT_FOR_DELIVERY" && !o.deliveryTripId);
}

export function readyCount(board: BoardData): number {
  return allBoardOrders(board).filter(isReadyForDispatch).length;
}

/** Header line: a rider's stops left to deliver, or the dispatcher's count of orders ready to go */
export function boardSubtitle(board: BoardData | null, trips: { rider: { id: string }; status: string; orders: { status: string }[] }[], riderId: string | null, riderOnly: boolean): string | undefined {
  if (riderOnly) {
    const stops = trips.filter((t) => t.rider.id === riderId && t.status !== "COMPLETED")
      .flatMap((t) => t.orders).filter((o) => o.status === "OUT_FOR_DELIVERY" || o.status === "READY").length;
    return `${stops} stop${stops === 1 ? "" : "s"} to deliver`;
  }
  return board ? `${readyCount(board)} ready to dispatch` : undefined;
}
