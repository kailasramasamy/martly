import type { Prisma } from "../../../generated/prisma/client.js";
import { applyMovement } from "../stock-ledger.js";

type Tx = Prisma.TransactionClient;

const RETURN_INCLUDE = {
  items: { include: { orderItem: { select: { storeProductId: true } } } },
  replacementItems: { select: { id: true, order: { select: { status: true } } } },
} as const;

export type ReturnWithItems = Prisma.ReturnRequestGetPayload<{ include: typeof RETURN_INCLUDE }>;

export async function loadReturn(tx: Tx, id: string): Promise<ReturnWithItems | null> {
  return tx.returnRequest.findUnique({ where: { id }, include: RETURN_INCLUDE });
}

/** What changed when a return was settled, for the customer notification */
export interface SettleOutcome {
  refunded: number | null;
  completed: boolean;
}

/** Credit the approved amount once; a concurrent settle that lost the claim refunds nothing */
async function refundToWallet(tx: Tx, rr: ReturnWithItems): Promise<number | null> {
  const claim = await tx.returnRequest.updateMany({ where: { id: rr.id, refundedAt: null }, data: { refundedAt: new Date() } });
  if (claim.count === 0) return null;
  const amount = Number(rr.approvedAmount ?? 0);
  if (amount > 0) {
    const user = await tx.user.update({ where: { id: rr.userId }, data: { walletBalance: { increment: amount } } });
    await tx.walletTransaction.create({
      data: {
        userId: rr.userId,
        orderId: rr.orderId,
        type: "CREDIT",
        amount,
        balanceAfter: Number(user.walletBalance),
        description: `Refund for return request on order #${rr.orderId.slice(0, 8)}`,
      },
    });
  }
  return amount;
}

/** A replacement counts as sent once it rides on an order that wasn't cancelled */
function replacementSent(rr: ReturnWithItems): boolean {
  return rr.replacementItems.some((i) => i.order.status !== "CANCELLED");
}

/**
 * Move an approved return forward: refund once the item is back (or straight away when the customer keeps it),
 * and mark it completed when nothing is left to wait for.
 */
export async function settleReturn(tx: Tx, rr: ReturnWithItems): Promise<SettleOutcome> {
  if (rr.status !== "IN_PROGRESS") return { refunded: null, completed: false };
  const itemBack = rr.method === "KEEP" || !!rr.receivedAt;

  let refunded: number | null = null;
  if (rr.remedy === "REFUND" && itemBack && !rr.refundedAt) refunded = await refundToWallet(tx, rr);

  const remedyDone = rr.remedy === "REFUND" ? !!rr.refundedAt || refunded !== null : replacementSent(rr);
  const completed = itemBack && remedyDone;
  if (completed) await tx.returnRequest.update({ where: { id: rr.id }, data: { status: "APPROVED" } });
  return { refunded, completed };
}

/** The item is back with the store: put resellable units on the shelf, then settle */
export async function receiveReturn(
  tx: Tx,
  rr: ReturnWithItems,
  by: { userId: string; orderId?: string },
): Promise<SettleOutcome> {
  const receivedAt = new Date();
  const claim = await tx.returnRequest.updateMany({
    where: { id: rr.id, status: "IN_PROGRESS", method: { in: ["NEXT_ORDER", "AT_STORE"] }, receivedAt: null },
    data: { receivedAt, receivedBy: by.userId, collectedOnOrderId: by.orderId ?? null },
  });
  if (claim.count === 0) throw Object.assign(new Error("This return isn't waiting for an item"), { statusCode: 400 });
  for (const item of rr.items.filter((i) => i.restock)) {
    await applyMovement(tx, {
      storeProductId: item.orderItem.storeProductId,
      quantity: item.quantity,
      type: "RETURN",
      orderId: rr.orderId,
      userId: by.userId,
      note: by.orderId ? "Collected by rider" : "Dropped at store",
    });
  }
  return settleReturn(tx, { ...rr, receivedAt });
}
