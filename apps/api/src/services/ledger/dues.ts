import type { Messaging } from "firebase-admin/messaging";
import type { BalanceDue, PrismaClient } from "../../../generated/prisma/client.js";
import { createRazorpayOrder, getRazorpayKeyId } from "../payment.js";
import { spendableBalance } from "./balance.js";
import { money, postEntries } from "./post.js";
import { notifyDuePaid } from "../notify/finance-alerts.js";

const httpError = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/** The open due, or a new one for what the organization owes now when refunds have outrun sales */
export async function openDue(prisma: PrismaClient, organizationId: string): Promise<BalanceDue> {
  const pending = await prisma.balanceDue.findFirst({ where: { organizationId, status: "PENDING" } });
  if (pending) return pending;
  const owed = money(-(await spendableBalance(prisma, organizationId)));
  if (owed <= 0) throw httpError("Your balance isn't negative; nothing is due");
  return prisma.balanceDue.create({ data: { organizationId, amount: owed } });
}

/** Razorpay checkout for a due; reused across attempts so a late payment still matches its due */
export async function dueCheckout(prisma: PrismaClient, due: BalanceDue) {
  let razorpayOrderId = due.razorpayOrderId;
  if (!razorpayOrderId) {
    const rp = await createRazorpayOrder(Math.round(Number(due.amount) * 100), `due_${due.id.slice(0, 8)}`, undefined, { balanceDueId: due.id });
    razorpayOrderId = rp.id;
    await prisma.balanceDue.update({ where: { id: due.id }, data: { razorpayOrderId } });
  }
  return { dueId: due.id, orderId: razorpayOrderId, amount: Math.round(Number(due.amount) * 100), currency: "INR", keyId: getRazorpayKeyId() };
}

/** Marks the due paid once (app verify, webhook or Martly's offline record) and credits the balance */
export async function settleDue(
  prisma: PrismaClient, fcm: Messaging | null, dueId: string,
  payment: { paymentId?: string; offlineReference?: string; by?: string },
) {
  const due = await prisma.$transaction(async (tx) => {
    const claim = await tx.balanceDue.updateMany({
      where: { id: dueId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), razorpayPaymentId: payment.paymentId, offlineReference: payment.offlineReference },
    });
    if (claim.count === 0) return null;
    const d = await tx.balanceDue.findUniqueOrThrow({ where: { id: dueId } });
    await postEntries(tx, [{
      organizationId: d.organizationId, type: "BALANCE_PAYMENT", amount: Number(d.amount), sourceType: "BALANCE_DUE", sourceId: d.id,
      memo: payment.paymentId ? `Balance paid online · ${payment.paymentId}` : `Balance paid by transfer · ${payment.offlineReference}`,
      createdBy: payment.by,
    }]);
    return d;
  });
  if (due) void notifyDuePaid(fcm, prisma, due).catch((err: unknown) => console.error("Due paid alert failed", err));
  return due;
}
