import { permittedNextStatuses, NEXT_ACTION_LABELS } from "@martly/shared/order-flow";
import type { PermissionSubject } from "@martly/shared/permissions";

export interface FlowOrder {
  status: string;
  fulfillmentType: string;
}

/** The forward step this member may take, or undefined when the order is terminal or the step isn't theirs */
export function forwardStatus(order: FlowOrder, member: PermissionSubject | null): string | undefined {
  return permittedNextStatuses(member, order.status, order.fulfillmentType).find((s) => s !== "CANCELLED");
}

export function canCancel(order: FlowOrder, member: PermissionSubject | null): boolean {
  return permittedNextStatuses(member, order.status, order.fulfillmentType).includes("CANCELLED");
}

export function actionLabel(status: string, fulfillmentType: string): string {
  const action = NEXT_ACTION_LABELS[status];
  if (!action) return status;
  return (fulfillmentType === "PICKUP" && action.pickupLabel) || action.label;
}

export function actionColor(status: string): string {
  return NEXT_ACTION_LABELS[status]?.color ?? "#0f766e";
}
