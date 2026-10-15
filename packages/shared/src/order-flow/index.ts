export const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const PICKUP_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function nextStatuses(status: string, fulfillmentType: string): string[] {
  const map = fulfillmentType === "PICKUP" ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS;
  return map[status] ?? [];
}

export const NEXT_ACTION_LABELS: Record<string, { label: string; pickupLabel?: string; color: string }> = {
  CONFIRMED: { label: "Confirm Order", color: "#3b82f6" },
  PREPARING: { label: "Start Preparing", color: "#06b6d4" },
  READY: { label: "Mark Ready", pickupLabel: "Mark Ready for Pickup", color: "#6366f1" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "#8b5cf6" },
  DELIVERED: { label: "Mark Delivered", pickupLabel: "Mark Picked Up", color: "#22c55e" },
  CANCELLED: { label: "Cancel Order", color: "#ef4444" },
};
