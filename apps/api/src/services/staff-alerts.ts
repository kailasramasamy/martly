import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { sendNotification } from "./notification.js";

/**
 * Alert the people who run a store that a new order needs attention:
 * ORG_ADMINs of the store's organization and STORE_MANAGERs assigned to the store.
 * Fire-and-forget — sendNotification never throws.
 */
export async function notifyStaffOfNewOrder(fcm: Messaging | null, prisma: PrismaClient, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      storeId: true,
      totalAmount: true,
      fulfillmentType: true,
      store: { select: { name: true, organizationId: true } },
      user: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  if (!order) return;

  const recipients = await prisma.user.findMany({
    where: {
      OR: [
        { role: "ORG_ADMIN", userStores: { some: { store: { organizationId: order.store.organizationId } } } },
        { role: "STORE_MANAGER", userStores: { some: { storeId: order.storeId } } },
      ],
    },
    select: { id: true },
  });

  const amount = `₹${order.totalAmount.toNumber().toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const items = `${order._count.items} item${order._count.items === 1 ? "" : "s"}`;
  const mode = order.fulfillmentType === "PICKUP" ? "pickup" : "delivery";
  await Promise.all(
    recipients.map((r) =>
      sendNotification(fcm, prisma, {
        userId: r.id,
        type: "NEW_ORDER",
        title: `New order · ${amount}`,
        body: `${order.user.name || "A customer"} · ${items} · ${mode} at ${order.store.name}`,
        data: { screen: "manage-order", orderId: order.id, storeId: order.storeId },
        sound: true,
      }),
    ),
  );
}
