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

/** Orders still being prepared, plus pickups waiting to be collected */
export function inKitchen(board: BoardData): BoardOrder[] {
  return allBoardOrders(board).filter((o) => PREPARING.has(o.status) || (o.fulfillmentType === "PICKUP" && o.status === "READY"));
}

export function readyCount(board: BoardData): number {
  return allBoardOrders(board).filter(isReadyForDispatch).length;
}
