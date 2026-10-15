import { nextStatuses, NEXT_ACTION_LABELS } from "@martly/shared/order-flow";

export interface FlowOrder {
  status: string;
  fulfillmentType: string;
}

/** The single forward step for an order, or undefined when it is terminal */
export function forwardStatus(order: FlowOrder): string | undefined {
  return nextStatuses(order.status, order.fulfillmentType).find((s) => s !== "CANCELLED");
}

export function canCancel(order: FlowOrder): boolean {
  return nextStatuses(order.status, order.fulfillmentType).includes("CANCELLED");
}

export function actionLabel(status: string, fulfillmentType: string): string {
  const action = NEXT_ACTION_LABELS[status];
  if (!action) return status;
  return (fulfillmentType === "PICKUP" && action.pickupLabel) || action.label;
}

export function actionColor(status: string): string {
  return NEXT_ACTION_LABELS[status]?.color ?? "#0f766e";
}
