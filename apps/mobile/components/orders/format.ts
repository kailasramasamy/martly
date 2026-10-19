import type { OrderSummary } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayDiff(date: Date, now = new Date()) {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(date) - start(now)) / DAY_MS);
}

function clock(date: Date) {
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

/** "Today, 8:14 AM", "Yesterday, 6:42 PM" or "12 Oct, 6:42 PM" */
export function friendlyTime(iso: string) {
  const date = new Date(iso);
  const diff = dayDiff(date);
  const day = diff === 0 ? "Today" : diff === -1 ? "Yesterday" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${day}, ${clock(date)}`;
}

/** "October 2026", the heading orders are grouped under */
export function monthKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** "7 – 9 AM" from slot times like "07:00" and "09:00" */
function slotRange(start: string, end: string) {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const hour = h % 12 || 12;
    return { text: m ? `${hour}:${String(m).padStart(2, "0")}` : `${hour}`, half: h < 12 ? "AM" : "PM" };
  };
  const a = fmt(start);
  const b = fmt(end);
  return a.half === b.half ? `${a.text} – ${b.text} ${b.half}` : `${a.text} ${a.half} – ${b.text} ${b.half}`;
}

/** "Tomorrow, 7 – 9 AM" for a scheduled slot, or null when the order has none */
export function slotLabel(order: Pick<OrderSummary, "scheduledDate" | "slotStartTime" | "slotEndTime">) {
  if (!order.scheduledDate || !order.slotStartTime || !order.slotEndTime) return null;
  const date = new Date(order.scheduledDate);
  const diff = dayDiff(date);
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${slotRange(order.slotStartTime, order.slotEndTime)}`;
}

/** "Arriving in 12 min" from the estimate, "Arriving soon" once it has passed, null without one */
export function etaLabel(estimatedDeliveryAt: string | null, now = Date.now()) {
  if (!estimatedDeliveryAt) return null;
  const minutes = Math.round((new Date(estimatedDeliveryAt).getTime() - now) / 60000);
  if (minutes <= 1) return "Arriving soon";
  if (minutes < 90) return `Arriving in ${minutes} min`;
  return `Arriving by ${clock(new Date(estimatedDeliveryAt))}`;
}

export function itemCount(order: Pick<OrderSummary, "items">) {
  return order.items.reduce((sum, i) => sum + i.quantity, 0);
}

/** The first product names plus "+N more" for the rest */
export function itemPreview(order: Pick<OrderSummary, "items">, shown = 2) {
  const names = order.items.slice(0, shown).map((i) => `${i.product.name} ${i.variant.name}`);
  const rest = order.items.length - shown;
  return { names, more: rest > 0 ? `+${rest} more` : null };
}

export function rupees(amount: string | number) {
  return `₹${Math.round(Number(amount)).toLocaleString("en-IN")}`;
}
