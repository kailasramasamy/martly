import { UNDO_DELIVERY_WINDOW_MS, deliveredAt, undoDeliveryTarget } from "@martly/shared/order-flow";
import type { OrderStatus, PaymentStatus, Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { applyMovement } from "./stock-ledger.js";
import { reverseOrderEntries } from "./ledger/order.js";
import { claimStatus, lockLoyaltyPoints } from "./order-guards.js";

type Tx = Prisma.TransactionClient;

export interface UndoableOrder {
  id: string;
  userId: string;
  storeId: string;
  status: string;
  fulfillmentType: string;
  paymentMethod: string;
  paymentStatus: string;
  /** Set only when delivering a COD order collected the money */
  codCollectedVia: string | null;
  loyaltyPointsEarned: number | null;
  deliveryTripId: string | null;
  statusLogs: { status: string; note: string | null; createdAt: Date }[];
}

/** Why this delivery can't be undone, or null when it can */
export async function undoDenial(prisma: PrismaClient, order: UndoableOrder, now = Date.now()): Promise<string | null> {
  if (order.status !== "DELIVERED") return "Only delivered orders can be undone";
  const at = deliveredAt(order.statusLogs);
  if (!at || now - at.getTime() > UNDO_DELIVERY_WINDOW_MS) return "Deliveries can only be undone within 2 hours. Raise a return instead.";
  const [returned, refused, reviewed, referral] = await Promise.all([
    prisma.returnRequest.findFirst({ where: { orderId: order.id }, select: { id: true } }),
    prisma.orderItem.findFirst({ where: { orderId: order.id, refusedQuantity: { gt: 0 } }, select: { id: true } }),
    prisma.review.findFirst({ where: { orderId: order.id }, select: { id: true } }),
    prisma.referral.findFirst({ where: { orderId: order.id }, select: { id: true } }),
  ]);
  if (returned) return "The customer has raised a return for this order. Handle it through returns instead.";
  if (refused) return "Items were handed back at the door and refunded, so the delivery can't be undone.";
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

/** Take back loyalty points the delivery earned, or what is left of them when some were already spent */
async function reverseLoyalty(tx: Tx, order: UndoableOrder) {
  const store = await tx.store.findUniqueOrThrow({ where: { id: order.storeId }, select: { organizationId: true } });
  const held = await lockLoyaltyPoints(tx, order.userId, store.organizationId);
  const points = Math.min(order.loyaltyPointsEarned ?? 0, held ?? 0);
  if (points <= 0) return;
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
  const codAutoPaid = order.paymentMethod === "COD" && order.paymentStatus === "PAID" && order.codCollectedVia !== null;

  // A second undo of the same delivery stops here instead of restoring stock and points again
  await claimStatus(tx, order.id, { status: order.status as OrderStatus, paymentStatus: order.paymentStatus as PaymentStatus }, target);
  await restoreStock(tx, order.id, ctx.userId);
  await reverseLoyalty(tx, order);
  await reverseOrderEntries(tx, order.id, ctx.userId);
  if (order.deliveryTripId) {
    await tx.deliveryTrip.updateMany({
      where: { id: order.deliveryTripId, status: "COMPLETED" },
      data: { status: "IN_PROGRESS", completedAt: null },
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { status: target, loyaltyPointsEarned: 0, ...(codAutoPaid ? { paymentStatus: "PENDING" as const, codCollectedVia: null } : {}) },
  });
  await tx.orderStatusLog.create({ data: { orderId: order.id, status: target, note: `Delivery undone: ${ctx.reason}` } });
  return target;
}
