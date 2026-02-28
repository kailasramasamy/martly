import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { NotificationType } from "../../generated/prisma/index.js";
import { broadcastNotification } from "./ws-manager.js";

const ORDER_STATUS_TITLES: Record<string, string> = {
  CONFIRMED: "Order Confirmed",
  PREPARING: "Preparing Your Order",
  READY: "Order Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Order Delivered",
  CANCELLED: "Order Cancelled",
};

const ORDER_STATUS_TO_TYPE: Record<string, NotificationType> = {
  CONFIRMED: "ORDER_CONFIRMED",
  PREPARING: "ORDER_PREPARING",
  READY: "ORDER_READY",
  OUT_FOR_DELIVERY: "ORDER_OUT_FOR_DELIVERY",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
};

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  campaignId?: string;
}

/**
 * Unified notification sender: persists to DB + sends FCM push + broadcasts WebSocket.
 * Fire-and-forget — never blocks the calling flow.
 */
export async function sendNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  options: SendNotificationOptions,
) {
  try {
    // 1. Persist to DB
    const notification = await prisma.notification.create({
      data: {
        userId: options.userId,
        type: options.type,
        title: options.title,
        body: options.body,
        imageUrl: options.imageUrl,
        data: options.data as any,
        campaignId: options.campaignId,
      },
    });

    // 2. Broadcast via WebSocket
    broadcastNotification(options.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl,
      data: notification.data,
      isRead: false,
      createdAt: notification.createdAt.toISOString(),
    });

    // 3. Send FCM push
    if (fcm) {
      const deviceTokens = await prisma.deviceToken.findMany({
        where: { userId: options.userId },
        select: { id: true, token: true },
      });

      if (deviceTokens.length > 0) {
        const tokens = deviceTokens.map((dt) => dt.token);
        const response = await fcm.sendEachForMulticast({
          tokens,
          notification: { title: options.title, body: options.body },
          data: options.data
            ? Object.fromEntries(Object.entries(options.data).map(([k, v]) => [k, String(v)]))
            : undefined,
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
      }
    }
  } catch {
    // Never block API response on notification failure
  }
}

/**
 * Send order status notification — same signature as before for backward compatibility.
 */
export async function sendOrderStatusNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  orderId: string,
  userId: string,
  newStatus: string,
) {
  const type = ORDER_STATUS_TO_TYPE[newStatus];
  if (!type) return;

  const title = ORDER_STATUS_TITLES[newStatus] ?? "Order Update";
  const body = `Your order #${orderId.slice(0, 8)} has been updated to ${newStatus.replace(/_/g, " ").toLowerCase()}.`;

  await sendNotification(fcm, prisma, {
    userId,
    type,
    title,
    body,
    data: { orderId, status: newStatus },
  });
}

/**
 * Send wallet credit/debit notification.
 */
export async function sendWalletNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  userId: string,
  walletType: "CREDIT" | "DEBIT",
  amount: number,
  description?: string,
) {
  const type: NotificationType = walletType === "CREDIT" ? "WALLET_CREDITED" : "WALLET_DEBITED";
  const title = walletType === "CREDIT" ? "Wallet Credited" : "Wallet Debited";
  const body = walletType === "CREDIT"
    ? `\u20B9${amount} has been added to your wallet. ${description ?? ""}`
    : `\u20B9${amount} has been debited from your wallet. ${description ?? ""}`;

  await sendNotification(fcm, prisma, {
    userId,
    type,
    title,
    body: body.trim(),
    data: { screen: "wallet" },
  });
}

/**
 * Send loyalty points notification.
 */
export async function sendLoyaltyNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  userId: string,
  loyaltyType: "EARN" | "REDEEM",
  points: number,
) {
  const type: NotificationType = loyaltyType === "EARN" ? "LOYALTY_POINTS_EARNED" : "LOYALTY_POINTS_REDEEMED";
  const title = loyaltyType === "EARN" ? "Points Earned!" : "Points Redeemed";
  const body = loyaltyType === "EARN"
    ? `You earned ${points} loyalty points. Keep shopping to earn more!`
    : `${points} loyalty points have been redeemed.`;

  await sendNotification(fcm, prisma, {
    userId,
    type,
    title,
    body,
    data: { screen: "loyalty" },
  });
}

const DB_BATCH_SIZE = 100;
const FCM_BATCH_SIZE = 500;

/**
 * Send campaign notifications to a list of user IDs.
 * Processes in batches to avoid overwhelming DB connection pool and FCM limits.
 */
export async function sendCampaignNotifications(
  fcm: Messaging | null,
  prisma: PrismaClient,
  campaignId: string,
  userIds: string[],
  options: {
    type: NotificationType;
    title: string;
    body: string;
    imageUrl?: string;
    data?: Record<string, unknown>;
  },
) {
  if (userIds.length === 0) return;

  // 1. Create DB notifications in batches
  const allNotifications = [];
  for (let i = 0; i < userIds.length; i += DB_BATCH_SIZE) {
    const batch = userIds.slice(i, i + DB_BATCH_SIZE);
    const notifications = await Promise.all(
      batch.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: options.type,
            title: options.title,
            body: options.body,
            imageUrl: options.imageUrl,
            data: options.data as any,
            campaignId,
          },
        }),
      ),
    );
    allNotifications.push(...notifications);
  }

  // 2. Broadcast via WebSocket (non-blocking, in-memory)
  for (const notification of allNotifications) {
    broadcastNotification(notification.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl,
      data: notification.data,
      isRead: false,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  // 3. Send FCM push in batches of 500 (FCM multicast limit)
  if (fcm) {
    const allTokens = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    if (allTokens.length > 0) {
      const fcmData = options.data
        ? Object.fromEntries(Object.entries(options.data).map(([k, v]) => [k, String(v)]))
        : undefined;

      for (let i = 0; i < allTokens.length; i += FCM_BATCH_SIZE) {
        const tokenBatch = allTokens.slice(i, i + FCM_BATCH_SIZE);
        fcm.sendEachForMulticast({
          tokens: tokenBatch.map((t) => t.token),
          notification: { title: options.title, body: options.body },
          data: fcmData,
        }).catch(() => {});
      }
    }
  }
}
