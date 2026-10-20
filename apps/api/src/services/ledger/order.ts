import { RETURN_WINDOW_HOURS } from "@martly/shared/constants";
import type { Prisma } from "../../../generated/prisma/client.js";
import { formatOrderRef } from "../notify/copy.js";
import { deliveryCommission, keptParts } from "./commission.js";
import { type EntryInput, postEntries } from "./post.js";

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
 * Sales are earned on delivery: money Martly took for the order (online, wallet, its own coupon) becomes owed
 * to the store once the return window has passed, less Martly's commission on what the customer kept. Wallet
 * credits for units handed back and referral rewards come straight off the balance.
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
  const platformCoupon = coupon && coupon.organizationId === null ? Number(order.couponDiscount ?? 0) : 0;
  const commission = await deliveryCommission(tx, order.id, store.organizationId, keptParts(order, refusal));

  const entries: EntryInput[] = [
    { ...sale, type: "SALE_ONLINE", amount: online, memo: `Online payment · order ${ref}` },
    { ...sale, type: "SALE_WALLET", amount: wallet, memo: `Wallet payment · order ${ref}` },
    { ...sale, type: "PLATFORM_COUPON", amount: platformCoupon, memo: `Martly coupon ${order.couponCode ?? ""} · order ${ref}` },
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
