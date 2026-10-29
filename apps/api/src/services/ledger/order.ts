import { RETURN_WINDOW_HOURS } from "@martly/shared/constants";
import { unitsValue } from "@martly/shared/order-flow";
import type { Prisma } from "../../../generated/prisma/client.js";
import { formatOrderRef } from "../notify/copy.js";
import { deliveryCommission, keptParts } from "./commission.js";
import { type EntryInput, postEntries } from "./post.js";
import { martlyCreditOn } from "../credits/spend.js";

type Tx = Prisma.TransactionClient;

const HOLD_MS = (RETURN_WINDOW_HOURS + 24) * 60 * 60 * 1000;

interface DeliveredOrder {
  id: string;
  storeId: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: unknown;
  walletAmountUsed: unknown;
  loyaltyPointsUsed: number | null;
  couponId: string | null;
  couponCode: string | null;
  couponDiscount: unknown;
}

interface DoorRefusal {
  refusedAmount: number;
  walletCredit: number;
  /** The part of the items, by price, the customer kept */
  keptShare: number;
}

interface CompletedReferral {
  id: string;
  referrerReward: number;
  refereeReward: number;
}

/** A redelivery after an undo posts fresh entries, so its source ids must differ from the reversed ones */
async function deliverySourceId(tx: Tx, orderId: string) {
  const prior = await tx.ledgerEntry.count({ where: { orderId, sourceType: "ORDER" } });
  return prior === 0 ? orderId : `${orderId}:${prior}`;
}

/**
 * Sales are earned on delivery: money Martly took for the order (online, wallet, its own coupon and credit) becomes owed
 * to the store once the return window has passed, less Martly's commission on what the customer kept. Martly's coupon
 * and credit cover only the goods kept, since the store has the rest back. Wallet credits for units handed back and
 * referral rewards come straight off the balance.
 */
export async function postDeliveryEntries(tx: Tx, order: DeliveredOrder, refusal: DoorRefusal, referral: CompletedReferral | null) {
  const store = await tx.store.findUniqueOrThrow({ where: { id: order.storeId }, select: { organizationId: true } });
  const ref = formatOrderRef(order.id);
  const sourceId = await deliverySourceId(tx, order.id);
  const base = { organizationId: store.organizationId, storeId: order.storeId, orderId: order.id };
  const sale = { ...base, sourceType: "ORDER" as const, sourceId, availableAt: new Date(Date.now() + HOLD_MS) };

  const wallet = Number(order.walletAmountUsed ?? 0);
  const online = order.paymentMethod === "ONLINE" && order.paymentStatus === "PAID"
    ? Number(order.totalAmount) - wallet - (order.loyaltyPointsUsed ?? 0)
    : 0;
  const coupon = order.couponId
    ? await tx.coupon.findUnique({ where: { id: order.couponId }, select: { organizationId: true } })
    : null;
  const platformCoupon = coupon && coupon.organizationId === null ? Number(order.couponDiscount ?? 0) * refusal.keptShare : 0;
  const platformCredit = (await martlyCreditOn(tx, order.id)) * refusal.keptShare;
  const commission = await deliveryCommission(tx, order.id, store.organizationId, keptParts(order, refusal));

  const entries: EntryInput[] = [
    { ...sale, type: "SALE_ONLINE", amount: online, memo: `Online payment · order ${ref}` },
    { ...sale, type: "SALE_WALLET", amount: wallet, memo: `Wallet payment · order ${ref}` },
    { ...sale, type: "PLATFORM_COUPON", amount: platformCoupon, memo: `Martly coupon ${order.couponCode ?? ""} · order ${ref}` },
    { ...sale, type: "PLATFORM_CREDIT", amount: platformCredit, memo: `Martly welcome credit · order ${ref}` },
    { ...sale, type: "COMMISSION", amount: -commission.amount, memo: `Martly commission · ${commission.memo} · order ${ref}` },
    { ...base, sourceType: "ORDER", sourceId, type: "DOOR_REFUND", amount: -refusal.walletCredit, memo: `Handed back at the door, refunded to wallet · order ${ref}` },
  ];
  if (referral) {
    entries.push({
      ...base, sourceType: "REFERRAL", sourceId: referral.id, type: "REFERRAL_REWARD",
      amount: -(referral.referrerReward + referral.refereeReward), memo: `Referral rewards · first order ${ref}`,
    });
  }
  await postEntries(tx, entries);
}

/**
 * Undoing a delivery reverses every entry it posted; each entry can be reversed only once. A reversal of an
 * entry still on hold matures with it, so the two always land in the same settlement.
 */
export async function reverseOrderEntries(tx: Tx, orderId: string, userId: string) {
  const posted = await tx.ledgerEntry.findMany({ where: { orderId, sourceType: "ORDER" } });
  await postEntries(tx, posted.map((e) => ({
    organizationId: e.organizationId, storeId: e.storeId, orderId, type: "REVERSAL" as const,
    amount: -Number(e.amount), sourceType: "LEDGER_ENTRY" as const, sourceId: e.id,
    availableAt: e.settlementId ? undefined : e.availableAt,
    memo: `Delivery undone · reverses ${e.memo}`, createdBy: userId,
  })));
}

const PLATFORM_FUNDED = ["PLATFORM_COUPON", "PLATFORM_CREDIT"] as const;

interface PlatformEntry {
  id: string;
  type: string;
  amount: unknown;
  sourceType: string;
}

/**
 * What a refunded return takes back of Martly's coupon and credit, by type: the returned units' share of what delivery
 * posted (`share`, by price among the kept units), never more than is still left after earlier returns. Entries an
 * undo reversed don't count.
 */
export function platformShareBack(entries: PlatformEntry[], reversedIds: Set<string>, share: number) {
  return PLATFORM_FUNDED.map((type) => {
    const live = entries.filter((e) => e.type === type && !reversedIds.has(e.id));
    const delivered = live.filter((e) => e.sourceType === "ORDER").reduce((sum, e) => sum + Number(e.amount), 0);
    const left = live.reduce((sum, e) => sum + Number(e.amount), 0);
    return { type, amount: Math.max(0, Math.min(delivered * share, left)) };
  });
}

interface RefundedReturn {
  id: string;
  orderId: string;
  organizationId: string;
  storeId: string;
  items: { orderItemId: string; quantity: number }[];
}

/** Ledger entries taking Martly's coupon and credit on returned units back off the store: the sale is undone */
export async function returnPlatformEntries(tx: Tx, rr: RefundedReturn): Promise<EntryInput[]> {
  const items = await tx.orderItem.findMany({ where: { orderId: rr.orderId }, select: { id: true, quantity: true, refusedQuantity: true, totalPrice: true } });
  const keptValue = unitsValue(items, items.map((i) => ({ orderItemId: i.id, quantity: i.quantity - i.refusedQuantity })));
  if (keptValue <= 0) return [];
  const entries = await tx.ledgerEntry.findMany({
    where: { orderId: rr.orderId, type: { in: [...PLATFORM_FUNDED] } }, select: { id: true, type: true, amount: true, sourceType: true },
  });
  if (entries.length === 0) return [];
  const reversals = await tx.ledgerEntry.findMany({ where: { type: "REVERSAL", sourceId: { in: entries.map((e) => e.id) } }, select: { sourceId: true } });
  const share = unitsValue(items, rr.items) / keptValue;
  const ref = formatOrderRef(rr.orderId);
  return platformShareBack(entries, new Set(reversals.map((r) => r.sourceId)), share).map(({ type, amount }) => ({
    organizationId: rr.organizationId, storeId: rr.storeId, orderId: rr.orderId, type, amount: -amount, sourceType: "RETURN" as const,
    sourceId: rr.id, memo: `${type === "PLATFORM_CREDIT" ? "Martly welcome credit" : "Martly coupon"} on returned items · order ${ref}`,
  }));
}
