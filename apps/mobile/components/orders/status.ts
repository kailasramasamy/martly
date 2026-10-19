import type { OrderSummary } from "./types";

interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: "Placed", bg: "#fef3c7", fg: "#92400e" },
  CONFIRMED: { label: "Confirmed", bg: "#dbeafe", fg: "#1d4ed8" },
  PREPARING: { label: "Packing", bg: "#cffafe", fg: "#0e7490" },
  READY: { label: "Packed", bg: "#e0e7ff", fg: "#4338ca" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", bg: "#ccfbf1", fg: "#0f766e" },
  DELIVERED: { label: "Delivered", bg: "#dcfce7", fg: "#15803d" },
  CANCELLED: { label: "Cancelled", bg: "#fee2e2", fg: "#b91c1c" },
};

const PICKUP_LABELS: Record<string, string> = { READY: "Ready for pickup", DELIVERED: "Picked up" };

export function statusMeta(order: Pick<OrderSummary, "status" | "fulfillmentType">): StatusMeta {
  const meta = STATUS_META[order.status] ?? { label: order.status, bg: "#f1f5f9", fg: "#475569" };
  const pickupLabel = order.fulfillmentType === "PICKUP" ? PICKUP_LABELS[order.status] : undefined;
  return pickupLabel ? { ...meta, label: pickupLabel } : meta;
}

const DELIVERY_STEPS = ["Placed", "Confirmed", "Packed", "On the way", "Delivered"];
const PICKUP_STEPS = ["Placed", "Confirmed", "Packing", "Ready", "Picked up"];

const DELIVERY_INDEX: Record<string, number> = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4 };
const PICKUP_INDEX: Record<string, number> = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, DELIVERED: 4 };

/** The tracker's step labels and which one the order is on */
export function orderSteps(order: Pick<OrderSummary, "status" | "fulfillmentType">) {
  const pickup = order.fulfillmentType === "PICKUP";
  return {
    steps: pickup ? PICKUP_STEPS : DELIVERY_STEPS,
    current: (pickup ? PICKUP_INDEX : DELIVERY_INDEX)[order.status] ?? 0,
  };
}

/** Out for delivery, or waiting at the counter: the moments the customer acts on */
export function isHeadlineStatus(order: Pick<OrderSummary, "status" | "fulfillmentType">) {
  return order.status === "OUT_FOR_DELIVERY" || (order.status === "READY" && order.fulfillmentType === "PICKUP");
}
