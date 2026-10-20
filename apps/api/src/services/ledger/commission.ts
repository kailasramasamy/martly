import type { Prisma } from "../../../generated/prisma/client.js";
import { formatOrderRef } from "../notify/copy.js";
import { type EntryInput, money } from "./post.js";

type Tx = Prisma.TransactionClient;

interface PaidOrder {
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: unknown;
  walletAmountUsed: unknown;
  loyaltyPointsUsed: number | null;
}

interface Refusal {
  refusedAmount: number;
  walletCredit: number;
}

export interface PaidParts {
  online: number;
  wallet: number;
  cash: number;
}

/**
 * What the customer paid for and kept, by method; loyalty points and coupons were never paid. Units handed back
 * at the door first reduce the cash collected, and the rest was credited to the wallet, which comes off the
 * parts Martly holds in proportion.
 */
export function keptParts(order: PaidOrder, refusal: Refusal): PaidParts {
  const wallet = Number(order.walletAmountUsed ?? 0);
  const rest = Number(order.totalAmount) - wallet - (order.loyaltyPointsUsed ?? 0);
  const online = order.paymentMethod === "ONLINE" && order.paymentStatus === "PAID" ? rest : 0;
  const cash = order.paymentMethod === "COD" ? Math.max(0, rest - (refusal.refusedAmount - refusal.walletCredit)) : 0;
  const held = online + wallet;
  const kept = held > 0 ? Math.max(0, held - refusal.walletCredit) / held : 0;
  return { online: online * kept, wallet: wallet * kept, cash };
}

function commissionMemo(parts: PaidParts, onlinePct: number, codPct: number): string {
  return [
    parts.online > 0 && `₹${money(parts.online)} online at ${onlinePct}%`,
    parts.cash > 0 && `₹${money(parts.cash)} COD at ${codPct}%`,
    parts.wallet > 0 && `₹${money(parts.wallet)} wallet at ${codPct}%`,
  ].filter(Boolean).join(", ");
}

/**
 * Martly's commission (GST included) on a delivered order, at the organization's current rates: the online rate
 * covers the payment gateway, so wallet and COD pay the lower rate. The base and amount are recorded on the order
 * so a later return refunds at the rate actually charged.
 */
export async function deliveryCommission(tx: Tx, orderId: string, organizationId: string, parts: PaidParts) {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId }, select: { onlineCommissionPct: true, codCommissionPct: true },
  });
  const onlinePct = Number(org.onlineCommissionPct);
  const codPct = Number(org.codCommissionPct);
  const amount = money((parts.online * onlinePct + (parts.wallet + parts.cash) * codPct) / 100);
  await tx.order.update({
    where: { id: orderId },
    data: { commissionBase: money(parts.online + parts.wallet + parts.cash), commissionAmount: amount },
  });
  return { amount, memo: commissionMemo(parts, onlinePct, codPct) };
}

interface RefundedReturn {
  id: string;
  orderId: string;
  organizationId: string;
  storeId: string;
}

/** The commission on a refunded return goes back to the store at the order's rate, never more than was charged */
export async function commissionRefund(tx: Tx, rr: RefundedReturn, refunded: number): Promise<EntryInput | null> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: rr.orderId }, select: { commissionBase: true, commissionAmount: true } });
  const base = Number(order.commissionBase ?? 0);
  const charged = Number(order.commissionAmount ?? 0);
  if (base <= 0 || charged <= 0) return null;
  const earlier = await tx.ledgerEntry.aggregate({ where: { orderId: rr.orderId, type: "COMMISSION_REFUND" }, _sum: { amount: true } });
  const amount = money(Math.min((refunded * charged) / base, charged - Number(earlier._sum.amount ?? 0)));
  if (amount <= 0) return null;
  return {
    organizationId: rr.organizationId, storeId: rr.storeId, orderId: rr.orderId, type: "COMMISSION_REFUND", amount,
    sourceType: "RETURN", sourceId: rr.id, memo: `Commission refund · return on order ${formatOrderRef(rr.orderId)}`,
  };
}
