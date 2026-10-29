import { RETURN_WINDOW_HOURS } from "@martly/shared/constants";
import { awaitingPayment, deliveredAt } from "@martly/shared/order-flow";
import { strings } from "../../lib/i18n";
import { formatDate, formatTime } from "../../lib/i18n/format";
import { etaLabel, slotLabel } from "../orders/format";
import type { OrderData } from "./types";

// Each step lists the statuses it covers; packing and packed share a step on delivery orders
const DELIVERY_STEPS = [["PENDING"], ["CONFIRMED"], ["PREPARING", "READY"], ["OUT_FOR_DELIVERY"], ["DELIVERED"]];
const PICKUP_STEPS = [["PENDING"], ["CONFIRMED"], ["PREPARING"], ["READY"], ["DELIVERED"]];

const isPickup = (order: OrderData) => order.fulfillmentType === "PICKUP";
const shortDay = (date: Date | string) => formatDate(date, { day: "numeric", month: "short" });
const clock = (date: Date | string) => formatTime(date, { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();

/** Step labels and the reached step, for the progress bar */
export function orderProgress(order: OrderData) {
  const { card, cardPickup } = strings("orders").status;
  const steps = isPickup(order) ? PICKUP_STEPS : DELIVERY_STEPS;
  const labels = isPickup(order)
    ? [card.PENDING, card.CONFIRMED, card.PREPARING, cardPickup.READY, cardPickup.DELIVERED]
    : [card.PENDING, card.CONFIRMED, card.PREPARING, card.OUT_FOR_DELIVERY, card.DELIVERED];
  return { labels, current: Math.max(0, steps.findIndex((s) => s.includes(order.status))) };
}

const slotOf = (order: OrderData) =>
  slotLabel({ scheduledDate: order.scheduledDate ?? null, slotStartTime: order.slotStartTime ?? null, slotEndTime: order.slotEndTime ?? null });

/** The status as a sentence ("Delivered 30 Sep") with one line of detail under it */
export function orderHeadline(order: OrderData): { title: string; sub: string } {
  const t = strings("orders").detail;
  const placed = t.placedOn(`${shortDay(order.createdAt)}, ${clock(order.createdAt)}`);
  if (order.status === "DELIVERED") {
    const at = deliveredAt(order.statusLogs ?? []) ?? new Date(order.updatedAt);
    return { title: isPickup(order) ? t.headPickedUp(shortDay(at)) : t.headDelivered(shortDay(at)), sub: t.handedOver(clock(at)) };
  }
  if (order.status === "CANCELLED") return { title: t.headCancelled, sub: placed };
  if (awaitingPayment(order)) return { title: t.headAwaitingPayment, sub: t.subAwaitingPayment };
  if (order.status === "OUT_FOR_DELIVERY") {
    return { title: etaLabel(order.estimatedDeliveryAt ?? null) ?? t.headOnTheWay, sub: t.headActive.OUT_FOR_DELIVERY };
  }
  if (order.status === "READY" && isPickup(order)) return { title: t.headReadyPickup, sub: slotOf(order) ?? placed };
  const step = t.headActive[order.status as keyof typeof t.headActive] ?? order.status;
  const slot = slotOf(order);
  return slot ? { title: isPickup(order) ? t.headPickupAt(slot) : t.headArriving(slot), sub: step } : { title: step, sub: placed };
}

/** "Return or replace by 22 Oct, 4:12 PM", or when the window closed; null before delivery */
export function returnWindowLine(order: OrderData, now = Date.now()) {
  if (order.status !== "DELIVERED") return null;
  const at = deliveredAt(order.statusLogs ?? []);
  if (!at) return null;
  const until = new Date(at.getTime() + RETURN_WINDOW_HOURS * 3600 * 1000);
  const t = strings("orders").detail;
  const open = now < until.getTime();
  return { open, text: open ? t.returnBy(`${shortDay(until)}, ${clock(until)}`) : t.returnClosed(shortDay(until)) };
}
