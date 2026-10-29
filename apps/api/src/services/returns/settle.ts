import type { Prisma } from "../../../generated/prisma/client.js";
import { applyMovement } from "../stock-ledger.js";
import { commissionRefund } from "../ledger/commission.js";
import { postEntries } from "../ledger/post.js";
import { returnPlatformEntries } from "../ledger/order.js";
import { formatOrderRef } from "../notify/copy.js";

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

/**
 * Refund the approved amount once; a concurrent settle that lost the claim refunds nothing. A wallet refund is
 * Martly's money, so it is debited to the store; cash handed over with the item comes from the store's own till.
 * Either way Martly's commission on the refunded amount goes back to the store, and Martly's coupon and credit on the
 * returned units come back off it.
 */
async function refund(tx: Tx, rr: ReturnWithItems, inCash: boolean): Promise<number | null> {
  const claim = await tx.returnRequest.updateMany({ where: { id: rr.id, refundedAt: null }, data: { refundedAt: new Date() } });
  if (claim.count === 0) return null;
  const amount = Number(rr.approvedAmount ?? 0);
  const commission = amount > 0 ? await commissionRefund(tx, rr, amount) : null;
  if (commission) await postEntries(tx, [commission]);
  if (amount > 0) await postEntries(tx, await returnPlatformEntries(tx, rr));
  if (amount > 0 && !inCash) {
    const user = await tx.user.update({ where: { id: rr.userId }, data: { walletBalance: { increment: amount } } });
    await tx.walletTransaction.create({
      data: {
        userId: rr.userId,
        orderId: rr.orderId,
        type: "CREDIT",
        amount,
        balanceAfter: Number(user.walletBalance),
        description: `Refund for return request on order #${rr.orderId.slice(0, 8)}`,
        reason: "RETURN_REFUND",
        organizationId: rr.organizationId,
        storeId: rr.storeId,
      },
    });
    await postEntries(tx, [{
      organizationId: rr.organizationId, storeId: rr.storeId, orderId: rr.orderId, type: "RETURN_REFUND",
      amount: -amount, sourceType: "RETURN", sourceId: rr.id, memo: `Return refund · order ${formatOrderRef(rr.orderId)}`,
    }]);
  }
  return amount;
}

/** A replacement counts as sent once it rides on an order that wasn't cancelled */
function replacementSent(rr: ReturnWithItems): boolean {
  return rr.replacementItems.some((i) => i.order.status !== "CANCELLED");
}

/**
 * Move an approved return forward: refund once the item is back (or straight away when the customer keeps it),
 * and mark it completed when nothing is left to wait for. Cash is paid only `atHandover`, when the rider or
 * counter takes the item and pays on the spot; every other refund goes to the wallet.
 */
export async function settleReturn(tx: Tx, rr: ReturnWithItems, atHandover = false): Promise<SettleOutcome> {
  if (rr.status !== "IN_PROGRESS") return { refunded: null, completed: false };
  const itemBack = rr.method === "KEEP" || !!rr.receivedAt;

  let refunded: number | null = null;
  if (rr.remedy === "REFUND" && itemBack && !rr.refundedAt) refunded = await refund(tx, rr, atHandover && rr.refundTo === "CASH");

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
  return settleReturn(tx, { ...rr, receivedAt }, true);
}
