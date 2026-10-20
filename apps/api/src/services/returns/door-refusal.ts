import type { Prisma } from "../../../generated/prisma/client.js";
import type { RefuseReason } from "@martly/shared/constants";
import { amountDue, refusedValue } from "@martly/shared/order-flow";
import { deductStock } from "../stock.js";
import { applyMovement } from "../stock-ledger.js";

type Tx = Prisma.TransactionClient;

interface RefusedLine {
  orderItemId: string;
  quantity: number;
  reason: RefuseReason;
}

interface DeliveringOrder {
  id: string;
  userId: string;
  storeId: string;
  totalAmount: unknown;
  paymentMethod: string;
  paymentStatus: string;
  walletAmountUsed: unknown;
  couponDiscount: unknown;
  loyaltyPointsUsed: number | null;
  items: { id: string; storeProductId: string; quantity: number; unitPrice: unknown }[];
}

export interface DoorRefusal {
  refusedAmount: number;
  walletCredit: number;
  note: string | null;
}

const fail = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

/** Damaged or expired units handed back are written off; the rest go back on the shelf untouched */
const WRITE_OFF: Partial<Record<RefuseReason, "DAMAGE" | "EXPIRY">> = { DAMAGED: "DAMAGE", EXPIRED: "EXPIRY" };

function validate(order: DeliveringOrder, refused: RefusedLine[]) {
  const items = new Map(order.items.map((i) => [i.id, i]));
  if (new Set(refused.map((r) => r.orderItemId)).size !== refused.length) throw fail("Each item can be handed back once");
  for (const r of refused) {
    const item = items.get(r.orderItemId);
    if (!item) throw fail("That item isn't in this order");
    if (r.quantity > item.quantity) throw fail("More units handed back than were ordered");
  }
  const kept = order.items.reduce((n, i) => n + i.quantity, 0) - refused.reduce((n, r) => n + r.quantity, 0);
  if (kept <= 0) throw fail("Everything was handed back. Mark it as couldn't deliver instead.");
  return items;
}

/**
 * Deliver an order, less any units the customer handed back at the door: only kept units are sold,
 * damaged or expired ones are written off, and money for them comes off the cash due or goes to the wallet.
 */
export async function deliverWithRefusals(tx: Tx, order: DeliveringOrder, refused: RefusedLine[], userId: string): Promise<DoorRefusal> {
  const items = validate(order, refused);
  const refusedQty = new Map(refused.map((r) => [r.orderItemId, r.quantity]));
  const sold = order.items.map((i) => ({ storeProductId: i.storeProductId, quantity: i.quantity - (refusedQty.get(i.id) ?? 0) }));
  await deductStock(tx, sold.filter((s) => s.quantity > 0), { orderId: order.id, userId });

  for (const r of refused) {
    const item = items.get(r.orderItemId)!;
    await tx.orderItem.update({ where: { id: item.id }, data: { refusedQuantity: r.quantity, refusedReason: r.reason } });
    // Kept units released their reservation in deductStock; release the refused ones too
    await tx.$executeRaw`UPDATE store_products SET reserved_stock = GREATEST(reserved_stock - ${r.quantity}, 0) WHERE id = ${item.storeProductId}`;
    const writeOff = WRITE_OFF[r.reason];
    if (writeOff) {
      await applyMovement(tx, { storeProductId: item.storeProductId, quantity: -r.quantity, type: writeOff, orderId: order.id, userId, note: "Handed back at the door" });
    }
  }
  const priced = { couponDiscount: Number(order.couponDiscount ?? 0), items: order.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })) };
  const refusedAmount = refusedValue(priced, refused);
  if (refusedAmount === 0) return { refusedAmount, walletCredit: 0, note: null };

  // Whatever the customer already paid for refused units (online, wallet or points) comes back to the wallet
  const cashDue = amountDue({ ...order, totalAmount: Number(order.totalAmount), walletAmountUsed: Number(order.walletAmountUsed ?? 0) });
  const walletCredit = Math.max(0, refusedAmount - cashDue);
  if (walletCredit > 0) {
    const user = await tx.user.update({ where: { id: order.userId }, data: { walletBalance: { increment: walletCredit } } });
    const store = await tx.store.findUniqueOrThrow({ where: { id: order.storeId }, select: { organizationId: true } });
    await tx.walletTransaction.create({
      data: {
        userId: order.userId, orderId: order.id, type: "CREDIT", amount: walletCredit, balanceAfter: Number(user.walletBalance),
        description: `Refund for items handed back on order #${order.id.slice(0, 8)}`, reason: "DOOR_REFUND",
        organizationId: store.organizationId, storeId: order.storeId,
      },
    });
  }
  const units = refused.reduce((n, r) => n + r.quantity, 0);
  return { refusedAmount, walletCredit, note: `${units} unit${units === 1 ? "" : "s"} handed back at the door (₹${Math.round(refusedAmount)})` };
}
