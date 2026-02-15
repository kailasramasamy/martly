import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../generated/prisma/client.js";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Order Received",
  CONFIRMED: "Order Confirmed",
  PREPARING: "Preparing Your Order",
  READY: "Order Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Order Delivered",
  CANCELLED: "Order Cancelled",
};

export async function sendOrderStatusNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  orderId: string,
  userId: string,
  newStatus: string,
) {
  if (!fcm) return;

  try {
    const deviceTokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });

    if (deviceTokens.length === 0) return;

    const tokens = deviceTokens.map((dt) => dt.token);
    const title = STATUS_LABELS[newStatus] ?? "Order Update";
    const body = `Your order ${orderId.slice(0, 8)}… has been updated to ${newStatus.replace(/_/g, " ").toLowerCase()}.`;

    const response = await fcm.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { orderId, status: newStatus, type: "ORDER_STATUS_UPDATE" },
    });

    // Clean up invalid tokens
    const invalidTokenIds: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (
        !resp.success &&
        resp.error &&
        (resp.error.code === "messaging/invalid-registration-token" ||
          resp.error.code === "messaging/registration-token-not-registered")
      ) {
        invalidTokenIds.push(deviceTokens[idx].id);
      }
    });

    if (invalidTokenIds.length > 0) {
      await prisma.deviceToken.deleteMany({
        where: { id: { in: invalidTokenIds } },
      });
    }
  } catch {
    // Never block API response on notification failure
  }
}
