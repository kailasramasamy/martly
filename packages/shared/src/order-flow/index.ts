import { Permission } from "../constants/index";
import { paidPerUnit } from "../offers/index";

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

/** Statuses a bulk update may set — final states run refunds, loyalty and stock side effects one order at a time; sending out needs a rider */
export const BULK_STATUSES = ["CONFIRMED", "PREPARING", "READY"] as const;

/** The permission needed to move an order into a status. Riders may also deliver orders on their own trip. */
export function transitionPermission(to: string): Permission {
  if (to === "CANCELLED") return Permission.ORDERS_CANCEL;
  if (to === "OUT_FOR_DELIVERY" || to === "DELIVERED") return Permission.ORDERS_DISPATCH;
  return Permission.ORDERS_PROCESS;
}

/** Next statuses this member may set (own-trip deliveries are checked by the API, not here) */
export function permittedNextStatuses(
  subject: { role: string; permissions?: readonly string[] } | null | undefined,
  status: string,
  fulfillmentType: string,
): string[] {
  if (!subject) return [];
  return nextStatuses(status, fulfillmentType).filter(
    (to) => subject.role === "SUPER_ADMIN" || !!subject.permissions?.includes(transitionPermission(to)),
  );
}

/** The step to apply to every selected order in bulk, or a hint explaining why there isn't one */
export function bulkStep(
  member: { role: string; permissions?: readonly string[] } | null | undefined,
  orders: readonly { status: string; fulfillmentType: string }[],
): { next?: string; hint?: string } {
  const forwards = new Set(orders.map((o) => permittedNextStatuses(member, o.status, o.fulfillmentType).find((s) => s !== "CANCELLED")));
  const [next] = [...forwards];
  if (forwards.size > 1) {
    const mixed = new Set(orders.map((o) => o.fulfillmentType)).size > 1;
    return { hint: mixed ? "Delivery and pickup orders have different next steps. Select one kind." : "These orders are at different stages. Select orders in the same stage." };
  }
  if (!next) return { hint: "You can't move these orders forward." };
  if (next === "OUT_FOR_DELIVERY") return { hint: "Send orders out with a rider from the Delivery tab." };
  if (!(BULK_STATUSES as readonly string[]).includes(next)) return { hint: "Mark orders delivered or picked up one at a time." };
  return { next };
}

/** A delivery marked by mistake can be undone this long afterwards; later it's a return */
export const UNDO_DELIVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Where an undone delivery goes back to: still on its way, or waiting at the counter */
export function undoDeliveryTarget(fulfillmentType: string): "OUT_FOR_DELIVERY" | "READY" {
  return fulfillmentType === "PICKUP" ? "READY" : "OUT_FOR_DELIVERY";
}

/** When the order was delivered, from its status history (latest DELIVERED entry) */
export function deliveredAt(statusLogs: readonly { status: string; createdAt: string | Date }[]): Date | null {
  const logs = statusLogs.filter((l) => l.status === "DELIVERED").map((l) => new Date(l.createdAt).getTime());
  return logs.length ? new Date(Math.max(...logs)) : null;
}

/** Whether this member may undo the delivery now (the API also checks returns, reviews and referrals) */
export function canUndoDelivery(
  member: { role: string; permissions?: readonly string[] } | null | undefined,
  order: { status: string; statusLogs: readonly { status: string; createdAt: string | Date }[] },
  now = Date.now(),
): boolean {
  if (!member || order.status !== "DELIVERED") return false;
  if (member.role !== "SUPER_ADMIN" && !member.permissions?.includes(Permission.ORDERS_CANCEL)) return false;
  const at = deliveredAt(order.statusLogs);
  return !!at && now - at.getTime() <= UNDO_DELIVERY_WINDOW_MS;
}

// Strings from JSON, Prisma Decimals on the server
type Amount = string | number | { toNumber(): number };

interface PayableOrder {
  totalAmount: Amount;
  paymentMethod?: string;
  paymentStatus?: string;
  walletAmountUsed?: Amount | null;
  loyaltyPointsUsed?: number | null;
  /** Value of items handed back to the rider at the door */
  refusedAmount?: Amount | null;
}

/** Cash a rider collects at the door: the total less wallet, loyalty and anything handed back; nothing once paid or online */
export function amountDue(order: PayableOrder): number {
  if (order.paymentMethod !== "COD" || order.paymentStatus === "PAID") return 0;
  return Math.max(
    0,
    Number(order.totalAmount) - Number(order.walletAmountUsed ?? 0) - Number(order.loyaltyPointsUsed ?? 0) - Number(order.refusedAmount ?? 0),
  );
}

/** Minutes an online order may stay unpaid before it's cancelled */
export const UNPAID_EXPIRY_MINUTES = 30;

/** What the customer pays online: the total less wallet and loyalty points already applied */
export function onlineCharge(order: PayableOrder): number {
  return Number(order.totalAmount) - Number(order.walletAmountUsed ?? 0) - Number(order.loyaltyPointsUsed ?? 0);
}

/** An online order still waiting for the customer's payment; it's cancelled once UNPAID_EXPIRY_MINUTES pass */
export function awaitingPayment(order: PayableOrder & { status: string; isSubscriptionOrder?: boolean }): boolean {
  return order.status === "PENDING" && order.paymentMethod === "ONLINE" && !order.isSubscriptionOrder
    && (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED");
}

/** When an unpaid online order is cancelled */
export function paymentDeadline(order: { createdAt: string | Date }): Date {
  return new Date(new Date(order.createdAt).getTime() + UNPAID_EXPIRY_MINUTES * 60_000);
}

/** The reminder shown before completing an order: collect cash on unpaid COD orders */
export function handoverNote(order: PayableOrder): string {
  const due = amountDue(order);
  if (due > 0) return `Collect ₹${Math.round(due).toLocaleString("en-IN")} in cash before handing it over.`;
  if (order.paymentStatus === "PAID") return "Already paid. Hand over the order.";
  return "This completes the order and notifies the customer.";
}

interface DiscountedOrder {
  couponDiscount?: Amount | null;
  creditDiscount?: Amount | null;
  items: readonly { id: string; quantity: number; totalPrice: Amount }[];
}

/** The part of the items' price the customer paid for: the rest was the coupon and welcome credit, never refunded as money */
export function paidShare(order: DiscountedOrder): number {
  const itemsTotal = order.items.reduce((sum, i) => sum + Number(i.totalPrice), 0);
  if (itemsTotal === 0) return 0;
  return Math.max(0, itemsTotal - Number(order.couponDiscount ?? 0) - Number(order.creditDiscount ?? 0)) / itemsTotal;
}

type Units = readonly { orderItemId: string; quantity: number }[];

/** What these units cost at the order's item prices (free units averaged in), before any coupon or credit */
export function unitsValue(items: DiscountedOrder["items"], units: Units): number {
  const price = new Map(items.map((i) => [i.id, paidPerUnit(i)]));
  return units.reduce((sum, u) => sum + (price.get(u.orderItemId) ?? 0) * u.quantity, 0);
}

/** What units handed back at the door are worth: what they were paid for, less their share of the order's coupon and credit */
export function refusedValue(order: DiscountedOrder, refused: Units): number {
  return Math.round(unitsValue(order.items, refused) * paidShare(order) * 100) / 100;
}

/** The part of the items, by price, the customer kept after handing these back; Martly's coupon and credit follow it */
export function keptShare(order: DiscountedOrder, refused: Units): number {
  const itemsTotal = order.items.reduce((sum, i) => sum + Number(i.totalPrice), 0);
  return itemsTotal > 0 ? Math.max(0, 1 - unitsValue(order.items, refused) / itemsTotal) : 1;
}

export type ReturnTone = "pending" | "active" | "done" | "declined" | "closed";

/** One line saying where an order's return stands, shown next to the Delivered status */
export function returnState(rr: {
  status: string;
  remedy?: string | null;
  method?: string | null;
  approvedAmount?: string | number | null;
}): { label: string; tone: ReturnTone } {
  switch (rr.status) {
    case "PENDING":
      return { label: "Return requested", tone: "pending" };
    case "IN_PROGRESS":
      return rr.remedy === "REPLACE" && rr.method === "KEEP"
        ? { label: "Replacement on its way", tone: "active" }
        : { label: "Return in progress", tone: "active" };
    case "APPROVED":
      return rr.remedy === "REPLACE"
        ? { label: "Replaced", tone: "done" }
        : { label: `\u20B9${Math.round(Number(rr.approvedAmount ?? 0)).toLocaleString("en-IN")} refunded`, tone: "done" };
    case "REJECTED":
      return { label: "Return declined", tone: "declined" };
    default:
      return { label: "Return closed", tone: "closed" };
  }
}
