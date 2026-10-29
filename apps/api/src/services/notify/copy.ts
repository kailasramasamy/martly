/** Short, readable order reference shown to customers and staff, e.g. "#3F9A12BC" */
export function formatOrderRef(orderId: string): string {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

/** ₹1,234 — paise only when the amount has them */
export function formatINR(amount: number | { toNumber(): number }): string {
  const value = typeof amount === "number" ? amount : amount.toNumber();
  const digits = Number.isInteger(value) ? 0 : 2;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

/** "Tue, 21 Oct" in IST */
export function formatISTDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export type CancelledBy = "customer" | "store" | "system";

export interface OrderCopyContext {
  orderId: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  storeName: string;
  riderName?: string | null;
  cancelledBy?: CancelledBy;
  reason?: string | null;
  refund?: { amount: number; to: "wallet" | "source" } | null;
  /** Set when the order is confirmed by its online payment; the customer may still be in their UPI app */
  paidAmount?: number;
}

function cancelCopy(ctx: OrderCopyContext): { title: string; body: string } {
  const ref = formatOrderRef(ctx.orderId);
  const refund = ctx.refund && ctx.refund.amount > 0
    ? ` ${formatINR(ctx.refund.amount)} ${ctx.refund.to === "wallet" ? "has been refunded to your Martly wallet" : "will be refunded to your original payment method"}.`
    : "";
  if (ctx.cancelledBy === "customer") return { title: "Order cancelled", body: `You cancelled order ${ref}.${refund}` };
  if (ctx.cancelledBy === "system") {
    return { title: "Order cancelled", body: `Order ${ref} was cancelled because payment wasn't completed.${refund}` };
  }
  const why = ctx.reason ? `: ${ctx.reason}` : ".";
  return { title: "Order cancelled by the store", body: `${ctx.storeName} cancelled order ${ref}${why}${refund}` };
}

/** Customer-facing title/body for an order status, worded for delivery vs pickup */
export function orderStatusCopy(status: string, ctx: OrderCopyContext): { title: string; body: string } | null {
  const ref = formatOrderRef(ctx.orderId);
  const pickup = ctx.fulfillmentType === "PICKUP";
  switch (status) {
    case "CONFIRMED":
      return ctx.paidAmount != null
        ? { title: "Payment received ✓", body: `${formatINR(ctx.paidAmount)} paid for order ${ref}. Tap to go back to Martly.` }
        : { title: "Order confirmed", body: `${ctx.storeName} has confirmed order ${ref}.` };
    case "PREPARING":
      return { title: "Packing your order", body: `${ctx.storeName} is packing order ${ref}.` };
    case "READY":
      return pickup
        ? { title: "Ready for pickup", body: `Order ${ref} is ready at ${ctx.storeName}. Show the order number at the counter.` }
        : { title: "Order packed", body: `Order ${ref} is packed and will be on its way soon.` };
    case "OUT_FOR_DELIVERY":
      return { title: "Out for delivery", body: `${ctx.riderName ?? "Your rider"} is on the way with order ${ref}.` };
    case "DELIVERED":
      return pickup
        ? { title: "Order collected", body: `Thanks for collecting order ${ref} from ${ctx.storeName}.` }
        : { title: "Order delivered", body: `Order ${ref} has been delivered. Enjoy!` };
    case "CANCELLED":
      return cancelCopy(ctx);
    default:
      return null;
  }
}
