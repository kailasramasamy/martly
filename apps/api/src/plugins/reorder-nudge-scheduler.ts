import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { sendNotification } from "../services/notification.js";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes after startup

async function reorderNudgeSchedulerPlugin(app: FastifyInstance) {
  async function processReorderNudges() {
    try {
      // Find all users who have device tokens (push-enabled)
      const usersWithTokens = await app.prisma.deviceToken.findMany({
        distinct: ["userId"],
        select: { userId: true },
      });

      if (usersWithTokens.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      for (const { userId } of usersWithTokens) {
        try {
          // Check if we already sent a reorder nudge today
          const existingNudge = await app.prisma.notification.findFirst({
            where: {
              userId,
              type: "PROMOTIONAL",
              createdAt: { gte: today, lt: tomorrow },
              data: { path: ["screen"], equals: "smart-reorder" },
            },
          });
          if (existingNudge) continue;

          // Find the user's most recent store
          const lastOrder = await app.prisma.order.findFirst({
            where: {
              userId,
              status: { in: ["DELIVERED", "CONFIRMED"] },
            },
            orderBy: { createdAt: "desc" },
            select: { storeId: true },
          });
          if (!lastOrder) continue;

          // Run a lightweight prediction check — just count overdue items
          const orderItems = await app.prisma.orderItem.findMany({
            where: {
              order: {
                userId,
                storeId: lastOrder.storeId,
                status: { in: ["DELIVERED", "CONFIRMED"] },
              },
            },
            select: {
              productId: true,
              variantId: true,
              quantity: true,
              order: { select: { createdAt: true } },
            },
            orderBy: { order: { createdAt: "asc" } },
          });

          if (orderItems.length === 0) continue;

          // Group by product:variant
          const groupMap = new Map<
            string,
            { orderCount: number; firstOrdered: Date; lastOrdered: Date; productId: string }
          >();

          for (const item of orderItems) {
            const key = `${item.productId}:${item.variantId}`;
            const existing = groupMap.get(key);
            const orderDate = item.order.createdAt;

            if (existing) {
              existing.orderCount += 1;
              if (orderDate < existing.firstOrdered) existing.firstOrdered = orderDate;
              if (orderDate > existing.lastOrdered) existing.lastOrdered = orderDate;
            } else {
              groupMap.set(key, {
                productId: item.productId,
                orderCount: 1,
                firstOrdered: orderDate,
                lastOrdered: orderDate,
              });
            }
          }

          const now = new Date();
          const overdueProductIds: string[] = [];

          for (const g of groupMap.values()) {
            if (g.orderCount < 2) continue;
            const spanDays =
              (g.lastOrdered.getTime() - g.firstOrdered.getTime()) / (1000 * 60 * 60 * 24);
            const avgInterval = spanDays / (g.orderCount - 1);
            if (avgInterval <= 0) continue;
            const daysSinceLast =
              (now.getTime() - g.lastOrdered.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLast / avgInterval >= 1.0) {
              overdueProductIds.push(g.productId);
            }
          }

          if (overdueProductIds.length === 0) continue;

          // Fetch product names for the notification body
          const products = await app.prisma.product.findMany({
            where: { id: { in: overdueProductIds.slice(0, 3) } },
            select: { name: true },
          });
          const names = products.map((p) => p.name);
          const bodyItems = names.length > 2
            ? `${names.slice(0, 2).join(", ")} and ${overdueProductIds.length - 2} more`
            : names.join(" and ");

          await sendNotification(app.fcm, app.prisma, {
            userId,
            type: "PROMOTIONAL",
            title: "Running low? Time to restock!",
            body: `You might need ${bodyItems}`,
            data: { screen: "smart-reorder" },
          });

          app.log.info(`Reorder nudge sent to user ${userId} (${overdueProductIds.length} overdue items)`);
        } catch (err) {
          app.log.error(err, `Failed to process reorder nudge for user ${userId}`);
        }
      }
    } catch (err) {
      app.log.error(err, "Error processing reorder nudges");
    }
  }

  let intervalId: ReturnType<typeof setInterval>;

  app.addHook("onReady", () => {
    // Delay first run to let the server settle
    setTimeout(() => {
      processReorderNudges();
      intervalId = setInterval(processReorderNudges, INTERVAL_MS);
    }, STARTUP_DELAY_MS);
    app.log.info("Reorder nudge scheduler registered (24h interval, 5min startup delay)");
  });

  app.addHook("onClose", () => {
    if (intervalId) clearInterval(intervalId);
  });
}

export default fp(reorderNudgeSchedulerPlugin, { name: "reorder-nudge-scheduler" });
