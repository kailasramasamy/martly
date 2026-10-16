import { UNDO_DELIVERY_WINDOW_MS, deliveredAt, undoDeliveryTarget } from "@martly/shared/order-flow";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { applyMovement } from "./stock-ledger.js";

type Tx = Prisma.TransactionClient;

const COD_AUTO_PAID_NOTE = "COD payment collected on delivery";

export interface UndoableOrder {
  id: string;
  userId: string;
  storeId: string;
  status: string;
  fulfillmentType: string;
  paymentMethod: string;
  paymentStatus: string;
  loyaltyPointsEarned: number | null;
  deliveryTripId: string | null;
  statusLogs: { status: string; note: string | null; createdAt: Date }[];
}

/** Why this delivery can't be undone, or null when it can */
export async function undoDenial(prisma: PrismaClient, order: UndoableOrder, now = Date.now()): Promise<string | null> {
  if (order.status !== "DELIVERED") return "Only delivered orders can be undone";
  const at = deliveredAt(order.statusLogs);
  if (!at || now - at.getTime() > UNDO_DELIVERY_WINDOW_MS) return "Deliveries can only be undone within 2 hours. Raise a return instead.";
  const [returned, reviewed, referral] = await Promise.all([
    prisma.returnRequest.findFirst({ where: { orderId: order.id }, select: { id: true } }),
    prisma.review.findFirst({ where: { orderId: order.id }, select: { id: true } }),
    prisma.referral.findFirst({ where: { orderId: order.id }, select: { id: true } }),
  ]);
  if (returned) return "The customer has raised a return for this order. Handle it through returns instead.";
  if (reviewed) return "The customer has already reviewed this order, so the delivery can't be undone.";
  if (referral) return "This delivery paid out a referral reward, so it can't be undone. Raise a return instead.";
  return null;
}

/** Put sold stock back on the shelf and re-reserve it for the order */
async function restoreStock(tx: Tx, orderId: string, userId: string) {
  const sales = await tx.stockMovement.findMany({ where: { orderId, type: "SALE" } });
  for (const sale of sales) {
    const quantity = -sale.quantity;
    if (quantity <= 0) continue;
    await applyMovement(tx, { storeProductId: sale.storeProductId, quantity, type: "UNDO_SALE", orderId, userId, note: "Delivery undone" });
    await tx.$executeRaw`UPDATE store_products SET reserved_stock = reserved_stock + ${quantity} WHERE id = ${sale.storeProductId}`;
  }
}

/** Take back loyalty points the delivery earned */
async function reverseLoyalty(tx: Tx, order: UndoableOrder) {
  const points = order.loyaltyPointsEarned ?? 0;
  if (points <= 0) return;
  const store = await tx.store.findUniqueOrThrow({ where: { id: order.storeId }, select: { organizationId: true } });
  const key = { userId_organizationId: { userId: order.userId, organizationId: store.organizationId } };
  const balance = await tx.loyaltyBalance.update({
    where: key,
    data: { points: { decrement: points }, totalEarned: { decrement: points } },
  });
  await tx.loyaltyTransaction.create({
    data: {
      userId: order.userId,
      organizationId: store.organizationId,
      orderId: order.id,
      type: "REVERSAL",
      points: -points,
      balanceAfter: balance.points,
      description: `Points reversed: delivery of order #${order.id.slice(0, 8)} was undone`,
    },
  });
}

/** Reverses everything marking the order delivered did, and moves it back a step. Run in one transaction. */
export async function undoDelivery(tx: Tx, order: UndoableOrder, ctx: { userId: string; reason: string }) {
  const target = undoDeliveryTarget(order.fulfillmentType);
  const lastDelivered = [...order.statusLogs].reverse().find((l) => l.status === "DELIVERED");
  const codAutoPaid = order.paymentMethod === "COD" && order.paymentStatus === "PAID" && lastDelivered?.note === COD_AUTO_PAID_NOTE;

  await restoreStock(tx, order.id, ctx.userId);
  await reverseLoyalty(tx, order);
  if (order.deliveryTripId) {
    await tx.deliveryTrip.updateMany({
      where: { id: order.deliveryTripId, status: "COMPLETED" },
      data: { status: "IN_PROGRESS", completedAt: null },
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { status: target, loyaltyPointsEarned: 0, ...(codAutoPaid ? { paymentStatus: "PENDING" as const } : {}) },
  });
  await tx.orderStatusLog.create({ data: { orderId: order.id, status: target, note: `Delivery undone: ${ctx.reason}` } });
  return target;
}
