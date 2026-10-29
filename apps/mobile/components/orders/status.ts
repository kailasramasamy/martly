import { awaitingPayment } from "@martly/shared/order-flow";
import { strings } from "../../lib/i18n";
import type { OrderSummary } from "./types";

interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: "#fef3c7", fg: "#92400e" },
  CONFIRMED: { bg: "#dbeafe", fg: "#1d4ed8" },
  PREPARING: { bg: "#cffafe", fg: "#0e7490" },
  READY: { bg: "#e0e7ff", fg: "#4338ca" },
  OUT_FOR_DELIVERY: { bg: "#ccfbf1", fg: "#0f766e" },
  DELIVERED: { bg: "#dcfce7", fg: "#15803d" },
  CANCELLED: { bg: "#fee2e2", fg: "#b91c1c" },
};

const AWAITING_PAYMENT_COLORS = { bg: "#fef3c7", fg: "#b45309" };

export function statusMeta(order: Pick<OrderSummary, "status" | "fulfillmentType" | "totalAmount" | "paymentMethod" | "paymentStatus">): StatusMeta {
  if (awaitingPayment(order)) return { label: strings("orders").card.paymentPending, ...AWAITING_PAYMENT_COLORS };
  const { card, cardPickup } = strings("orders").status as { card: Record<string, string>; cardPickup: Record<string, string> };
  const colors = STATUS_COLORS[order.status] ?? { bg: "#f1f5f9", fg: "#475569" };
  const pickupLabel = order.fulfillmentType === "PICKUP" ? cardPickup[order.status] : undefined;
  const label = pickupLabel ?? card[order.status] ?? order.status;
  return { label, ...colors };
}

/** Out for delivery, or waiting at the counter: the moments the customer acts on */
export function isHeadlineStatus(order: Pick<OrderSummary, "status" | "fulfillmentType">) {
  return order.status === "OUT_FOR_DELIVERY" || (order.status === "READY" && order.fulfillmentType === "PICKUP");
}
