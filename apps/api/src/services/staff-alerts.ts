import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { formatINR, plural } from "./notify/copy.js";
import { notifyStaff } from "./notify/staff.js";

/**
 * Alert the people who process a store's orders that a new one needs attention.
 * Express deliveries (no slot) are flagged so they're picked first. Fire-and-forget.
 */
export async function notifyStaffOfNewOrder(fcm: Messaging | null, prisma: PrismaClient, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      storeId: true,
      status: true,
      totalAmount: true,
      fulfillmentType: true,
      deliverySlotId: true,
      store: { select: { name: true } },
      user: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  if (!order || order.status === "CANCELLED") return;

  const express = order.fulfillmentType === "DELIVERY" && !order.deliverySlotId;
  const mode = order.fulfillmentType === "PICKUP" ? "pickup" : express ? "express delivery" : "delivery";
  await notifyStaff(fcm, prisma, order.storeId, { permissions: ["ORDERS_PROCESS"] }, {
    type: "NEW_ORDER",
    title: `${express ? "⚡ Express order" : "New order"} · ${formatINR(order.totalAmount)}`,
    body: `${order.user.name || "A customer"} · ${plural(order._count.items, "item")} · ${mode} at ${order.store.name}`,
    data: { screen: "manage-order", orderId: order.id },
  });
}
