import type { Prisma } from "../../../generated/prisma/client.js";
import { loadReturn, settleReturn } from "./settle.js";

type Tx = Prisma.TransactionClient;

/** What happened to each pending replacement when the customer placed an order */
export interface ReplacementResult {
  attached: string[];
  /** Out of stock, so the return became a refund; amount is null while the item is still to come back */
  refunded: { id: string; amount: number | null }[];
}

async function reserve(tx: Tx, storeProductId: string, quantity: number): Promise<boolean> {
  const res = await tx.$executeRaw`
    UPDATE store_products SET reserved_stock = reserved_stock + ${quantity}
    WHERE id = ${storeProductId} AND stock - reserved_stock >= ${quantity}`;
  return res > 0;
}

/** Reserve every unit or none, so a replacement never goes out half-filled */
async function reserveAll(tx: Tx, lines: { storeProductId: string; quantity: number }[]): Promise<boolean> {
  const done: typeof lines = [];
  for (const line of lines) {
    if (!(await reserve(tx, line.storeProductId, line.quantity))) {
      for (const d of done) {
        await tx.$executeRaw`UPDATE store_products SET reserved_stock = GREATEST(reserved_stock - ${d.quantity}, 0) WHERE id = ${d.storeProductId}`;
      }
      return false;
    }
    done.push(line);
  }
  return true;
}

/**
 * Add the customer's pending replacements at this store to a new order as free items.
 * A replacement that's out of stock becomes a refund instead.
 */
export async function attachReplacements(tx: Tx, order: { id: string; userId: string; storeId: string }): Promise<ReplacementResult> {
  const pending = await tx.returnRequest.findMany({
    where: {
      userId: order.userId, storeId: order.storeId, status: "IN_PROGRESS", remedy: "REPLACE",
      replacementItems: { none: { order: { status: { not: "CANCELLED" } } } },
    },
    select: { id: true, items: { select: { quantity: true, orderItem: { select: { productId: true, variantId: true, storeProductId: true, unitPrice: true } } } } },
  });
  const result: ReplacementResult = { attached: [], refunded: [] };
  for (const rr of pending) {
    const lines = rr.items.map((i) => ({ ...i.orderItem, quantity: i.quantity }));
    if (!(await reserveAll(tx, lines))) {
      await tx.returnRequest.update({ where: { id: rr.id }, data: { remedy: "REFUND" } });
      const outcome = await settleReturn(tx, (await loadReturn(tx, rr.id))!);
      result.refunded.push({ id: rr.id, amount: outcome.refunded });
      continue;
    }
    await tx.orderItem.createMany({
      data: lines.map((l) => ({
        orderId: order.id, productId: l.productId, variantId: l.variantId, storeProductId: l.storeProductId,
        quantity: l.quantity, unitPrice: 0, totalPrice: 0, originalPrice: l.unitPrice, replacesReturnId: rr.id,
      })),
    });
    await settleReturn(tx, (await loadReturn(tx, rr.id))!);
    result.attached.push(rr.id);
  }
  return result;
}

/** A cancelled order took its replacements with it: put those returns back to waiting for the next order */
export async function reopenReplacements(tx: Tx, orderId: string) {
  await tx.returnRequest.updateMany({
    where: { status: "APPROVED", remedy: "REPLACE", replacementItems: { some: { orderId } } },
    data: { status: "IN_PROGRESS" },
  });
}
