import type { FastifyInstance } from "fastify";
import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { sendNotification } from "../notification.js";
import { formatINR, formatOrderRef } from "./copy.js";

type Fcm = Messaging | null;

interface ReturnRef {
  userId: string;
  orderId: string;
  storeId: string;
  remedy: string | null;
  method: string | null;
  approvedAmount: unknown;
  adminNote?: string | null;
  refundTo?: string;
}

export type ReturnEvent =
  | { kind: "REJECTED" }
  | { kind: "APPROVED"; refunded: number | null }
  | { kind: "RECEIVED"; refunded: number | null }
  | { kind: "MOVED_TO_STORE" }
  | { kind: "EXPIRED" }
  | { kind: "REPLACEMENT_REFUNDED"; refunded: number };

async function storeName(prisma: PrismaClient, storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
  return store?.name ?? "the store";
}

/** What the customer has to do next with an approved return */
function handoverLine(rr: ReturnRef, store: string): string {
  const amount = formatINR(Number(rr.approvedAmount));
  const cash = rr.refundTo === "CASH" && rr.method !== "KEEP";
  const after = rr.remedy !== "REFUND" ? "" : cash ? ` You'll get ${amount} back in cash when you hand it over.` : ` Your ${amount} refund follows once we have it.`;
  if (rr.method === "NEXT_ORDER") return `Hand the item to our rider with your next order.${after}`;
  if (rr.method === "AT_STORE") return `Please drop the item at ${store}.${after}`;
  return "";
}

function approvedCopy(rr: ReturnRef, refunded: number | null, store: string) {
  if (refunded !== null) return { title: "Return approved", body: `${formatINR(refunded)} has been refunded to your Martly wallet.` };
  if (rr.remedy === "REPLACE") {
    return { title: "Replacement on its way", body: `We'll send a replacement with your next order. ${handoverLine(rr, store)}`.trim() };
  }
  return { title: "Return approved", body: handoverLine(rr, store) };
}

async function eventCopy(prisma: PrismaClient, rr: ReturnRef, event: ReturnEvent) {
  const ref = formatOrderRef(rr.orderId);
  const store = await storeName(prisma, rr.storeId);
  switch (event.kind) {
    case "REJECTED":
      return { title: "Return request declined", body: `Your return for order ${ref} was declined: ${rr.adminNote}` };
    case "APPROVED":
      return approvedCopy(rr, event.refunded, store);
    case "RECEIVED":
      if (event.refunded !== null && rr.refundTo === "CASH") {
        return { title: "Refunded in cash", body: `We've received your return for order ${ref} and refunded ${formatINR(event.refunded)} in cash.` };
      }
      return event.refunded !== null
        ? { title: "Refund credited", body: `We've received your return for order ${ref}. ${formatINR(event.refunded)} is in your Martly wallet.` }
        : { title: "Return received", body: `We've received the item you returned from order ${ref}.` };
    case "MOVED_TO_STORE":
      return { title: "Drop your return at the store", body: `We couldn't collect the item from order ${ref} with an order. Please drop it at ${store}.` };
    case "EXPIRED":
      return { title: "Return closed", body: `The item from order ${ref} wasn't returned in time, so the return has been closed.` };
    case "REPLACEMENT_REFUNDED":
      return { title: "Refund instead of replacement", body: `We couldn't send your replacement for order ${ref}, so ${formatINR(event.refunded)} is in your Martly wallet.` };
  }
}

export async function notifyReturnUpdate(fcm: Fcm, prisma: PrismaClient, rr: ReturnRef, event: ReturnEvent) {
  const note = event.kind === "APPROVED" && rr.adminNote ? ` ${rr.adminNote}` : "";
  const copy = await eventCopy(prisma, rr, event);
  await sendNotification(fcm, prisma, {
    userId: rr.userId, type: "RETURN_UPDATE", title: copy.title, body: `${copy.body}${note}`, data: { screen: "order", orderId: rr.orderId },
  });
}

/** Tell customers whose replacement was out of stock that they've been refunded instead */
export function notifyReplacementRefunds(app: FastifyInstance, result: { refunded: { id: string; amount: number | null }[] }) {
  for (const { id, amount } of result.refunded) {
    if (amount === null) continue;
    app.prisma.returnRequest.findUniqueOrThrow({ where: { id } })
      .then((rr) => notifyReturnUpdate(app.fcm, app.prisma, rr, { kind: "REPLACEMENT_REFUNDED", refunded: amount }))
      .catch((err: unknown) => app.log.error(err, `Replacement refund notification for ${id} failed`));
  }
}
