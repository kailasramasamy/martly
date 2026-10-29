import type { Messaging, SendResponse } from "firebase-admin/messaging";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { NotificationType } from "../../generated/prisma/index.js";
import { broadcastNotification } from "./ws-manager.js";
import { formatINR, orderStatusCopy, type CancelledBy } from "./notify/copy.js";

const ORDER_STATUS_TO_TYPE: Record<string, NotificationType> = {
  CONFIRMED: "ORDER_CONFIRMED",
  PREPARING: "ORDER_PREPARING",
  READY: "ORDER_READY",
  OUT_FOR_DELIVERY: "ORDER_OUT_FOR_DELIVERY",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
};

// Local testing on a prod-synced database: push only to these accounts (comma-separated user ids); in-app rows are unaffected
const PUSH_ONLY = process.env.PUSH_ONLY_USER_IDS?.split(",").map((id) => id.trim()).filter(Boolean);
const pushAllowed = (userId: string) => !PUSH_ONLY || PUSH_ONLY.includes(userId);

/** iOS shows `imageUrl` only through the app's notification service extension, which needs mutable-content */
function withImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return { apns: { aps: {} }, notification: {} };
  return { apns: { aps: { "mutable-content": 1 }, fcmOptions: { imageUrl } }, notification: { imageUrl } };
}

const DEAD_TOKEN_CODES = ["messaging/invalid-registration-token", "messaging/registration-token-not-registered"];

function isDeadToken(resp: SendResponse): boolean {
  if (resp.success || !resp.error) return false;
  // Older iOS builds registered raw APNs tokens, which FCM rejects as an invalid argument
  const notFcmToken = resp.error.code === "messaging/invalid-argument" && resp.error.message.includes("not a valid FCM registration token");
  return DEAD_TOKEN_CODES.includes(resp.error.code) || notFcmToken;
}

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  campaignId?: string;
  /** Play the default alert sound (iOS + Android); used for staff new-order alerts */
  sound?: boolean;
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
    if (fcm && pushAllowed(options.userId)) {
      const deviceTokens = await prisma.deviceToken.findMany({
        where: { userId: options.userId },
        select: { id: true, token: true },
      });

      if (deviceTokens.length > 0) {
        const tokens = deviceTokens.map((dt) => dt.token);
        // Updates about one order replace each other in the tray instead of stacking
        const image = withImage(options.imageUrl);
        const collapseId = options.data?.orderId ? `order-${options.data.orderId}-${options.type}` : undefined;
        const response = await fcm.sendEachForMulticast({
          tokens,
          notification: { title: options.title, body: options.body, ...image.notification },
          apns: {
            ...(collapseId ? { headers: { "apns-collapse-id": collapseId } } : {}),
            payload: { aps: { ...image.apns.aps, ...(options.sound ? { sound: "default" } : {}) } },
            ...(image.apns.fcmOptions ? { fcmOptions: image.apns.fcmOptions } : {}),
          },
          android: {
            ...(collapseId ? { collapseKey: collapseId } : {}),
            notification: { ...(options.sound ? { sound: "default" } : {}), ...(collapseId ? { tag: collapseId } : {}) },
          },
          data: options.data
            ? Object.fromEntries(Object.entries(options.data).map(([k, v]) => [k, String(v)]))
            : undefined,
        });

        const invalidTokenIds = deviceTokens.filter((_, idx) => isDeadToken(response.responses[idx])).map((dt) => dt.id);

        if (invalidTokenIds.length > 0) {
          await prisma.deviceToken.deleteMany({
            where: { id: { in: invalidTokenIds } },
          });
        }
      }
    }
  } catch (err) {
    // Never block the calling flow on a notification failure, but leave a trace
    console.error(`sendNotification failed (${options.type} → ${options.userId})`, err);
  }
}

export interface OrderStatusExtra {
  cancelledBy?: CancelledBy;
  reason?: string | null;
  refund?: { amount: number; to: "wallet" | "source" } | null;
  paidAmount?: number;
}

/** Tells the customer their order moved to `newStatus`, worded for delivery vs pickup */
export async function sendOrderStatusNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  orderId: string,
  newStatus: string,
  extra: OrderStatusExtra = {},
) {
  const type = ORDER_STATUS_TO_TYPE[newStatus];
  if (!type) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true, fulfillmentType: true,
      store: { select: { name: true } },
      deliveryTrip: { select: { rider: { select: { name: true } } } },
    },
  });
  if (!order) return;
  const copy = orderStatusCopy(newStatus, {
    orderId, fulfillmentType: order.fulfillmentType, storeName: order.store.name,
    riderName: order.deliveryTrip?.rider?.name, ...extra,
  });
  if (!copy) return;
  await sendNotification(fcm, prisma, {
    userId: order.userId, type, ...copy,
    data: { screen: "order", orderId, status: newStatus },
  });
}

/** Wallet credit/debit; pass `orderId` when it's an order refund so the tap opens the order */
export async function sendWalletNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  userId: string,
  walletType: "CREDIT" | "DEBIT",
  amount: number,
  description?: string,
  orderId?: string,
) {
  const type: NotificationType = walletType === "CREDIT" ? "WALLET_CREDITED" : "WALLET_DEBITED";
  const title = walletType === "CREDIT" ? "Wallet credited" : "Wallet debited";
  const verb = walletType === "CREDIT" ? "added to" : "debited from";
  const body = `${formatINR(amount)} has been ${verb} your wallet${description ? ` · ${description}` : "."}`;

  await sendNotification(fcm, prisma, {
    userId, type, title, body,
    data: orderId ? { screen: "order", orderId } : { screen: "wallet" },
  });
}

type LoyaltyEvent = "EARN" | "REDEEM" | "REVERSAL" | "ADJUST";

const LOYALTY_COPY: Record<LoyaltyEvent, (points: number, reason?: string) => { title: string; body: string }> = {
  EARN: (p, reason) => ({ title: "Points earned!", body: `You earned ${p} loyalty points${reason ? ` ${reason}` : ""}. Keep shopping to earn more!` }),
  REDEEM: (p) => ({ title: "Points redeemed", body: `${p} loyalty points were used on your order.` }),
  REVERSAL: (p, reason) => ({ title: "Points returned", body: `${p} loyalty points are back in your account${reason ? ` · ${reason}` : "."}` }),
  ADJUST: (p, reason) => ({ title: "Points adjusted", body: `Your loyalty balance changed by ${p} points${reason ? ` · ${reason}` : "."}` }),
};

/** Loyalty balance change; EARN/REDEEM for shopping, REVERSAL on cancel, ADJUST for staff corrections */
export async function sendLoyaltyNotification(
  fcm: Messaging | null,
  prisma: PrismaClient,
  userId: string,
  event: LoyaltyEvent,
  points: number,
  reason?: string,
) {
  const type: NotificationType = event === "REDEEM" || (event === "ADJUST" && points < 0) ? "LOYALTY_POINTS_REDEEMED" : "LOYALTY_POINTS_EARNED";
  await sendNotification(fcm, prisma, { userId, type, ...LOYALTY_COPY[event](points, reason), data: { screen: "loyalty" } });
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
    // Keeps a campaign that is still sending from being taken for a stale one (see notification-scheduler)
    await prisma.notificationCampaign.updateMany({ where: { id: campaignId, status: "SENDING" }, data: { updatedAt: new Date() } });
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
      where: { userId: { in: userIds.filter(pushAllowed) } },
      select: { id: true, token: true },
    });

    if (allTokens.length > 0) {
      const fcmData = options.data
        ? Object.fromEntries(Object.entries(options.data).map(([k, v]) => [k, String(v)]))
        : undefined;

      const image = withImage(options.imageUrl);
      for (let i = 0; i < allTokens.length; i += FCM_BATCH_SIZE) {
        const tokenBatch = allTokens.slice(i, i + FCM_BATCH_SIZE);
        // The in-app rows are already saved; a failed push batch is logged, not fatal to the campaign
        const response = await fcm.sendEachForMulticast({
          tokens: tokenBatch.map((t) => t.token),
          notification: { title: options.title, body: options.body, ...image.notification },
          apns: { payload: { aps: image.apns.aps }, ...(image.apns.fcmOptions ? { fcmOptions: image.apns.fcmOptions } : {}) },
          data: fcmData,
        }).catch((err: unknown) => {
          console.error(`Campaign ${campaignId} push batch failed`, err);
          return null;
        });
        if (!response) continue;
        const dead = tokenBatch.filter((_, idx) => isDeadToken(response.responses[idx])).map((t) => t.id);
        if (dead.length > 0) await prisma.deviceToken.deleteMany({ where: { id: { in: dead } } });
      }
    }
  }
}
