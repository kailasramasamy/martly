import type { PrismaClient } from "../../generated/prisma/index.js";
import { broadcastToOrderSubscribers, broadcastToUser, broadcastToAdmins } from "./ws-manager.js";

/**
 * Broadcast an order update via WebSocket after a status change.
 * - Sends full order data to clients subscribed to this specific orderId
 * - Sends lightweight hint to the customer's user-level connections
 * - Sends lightweight hint to all org-scoped admin connections
 */
export async function broadcastOrderUpdate(prisma: PrismaClient, orderId: string, newStatus: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true, variant: true } },
        statusLogs: { orderBy: { createdAt: "asc" } },
        store: { select: { organizationId: true } },
      },
    });
    if (!order) return;

    // Full order data to detail-screen subscribers (strip store relation)
    const { store, ...orderData } = order;
    broadcastToOrderSubscribers(orderId, orderData);

    // Lightweight hint to the customer's list-screen connections
    broadcastToUser(order.userId, orderId, newStatus);

    // Lightweight hint to all admins in the same org
    broadcastToAdmins(store.organizationId, orderId, newStatus);
  } catch {
    // WebSocket broadcast is best-effort; don't fail the HTTP response
  }
}
