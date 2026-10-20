import type { FastifyInstance } from "fastify";
import { createRazorpayOrder, ensureRazorpayCustomer } from "./payment.js";
import { sendWalletNotification } from "./notification.js";

/** Creates the Razorpay order for a top-up and records the amount server-side, so verify never trusts the client */
export async function createRecharge(app: FastifyInstance, userId: string, amount: number) {
  const customerId = await ensureRazorpayCustomer(app.prisma, userId);
  const amountInPaise = Math.round(amount * 100);
  const rpOrder = await createRazorpayOrder(amountInPaise, `w_${userId.slice(0, 8)}_${Date.now()}`, customerId);
  await app.prisma.walletRecharge.create({ data: { userId, razorpayOrderId: rpOrder.id, amount: amountInPaise / 100 } });
  return { razorpayOrderId: rpOrder.id, amountInPaise, customerId };
}

/**
 * Credits a paid top-up exactly once. The app's verify call and Razorpay's webhook both land here;
 * whichever flips PENDING→PAID first credits, the other is a no-op. Returns null for an unknown order.
 */
export async function settleRecharge(app: FastifyInstance, razorpayOrderId: string, paymentId: string, userId?: string) {
  const recharge = await app.prisma.walletRecharge.findUnique({ where: { razorpayOrderId } });
  if (!recharge || (userId && recharge.userId !== userId)) return null;

  const credited = await app.prisma.$transaction(async (tx) => {
    const { count } = await tx.walletRecharge.updateMany({
      where: { id: recharge.id, status: "PENDING" },
      data: { status: "PAID", razorpayPaymentId: paymentId },
    });
    if (count === 0) return false;
    const user = await tx.user.update({
      where: { id: recharge.userId },
      data: { walletBalance: { increment: recharge.amount } },
      select: { walletBalance: true },
    });
    await tx.walletTransaction.create({
      data: { userId: recharge.userId, type: "CREDIT", amount: recharge.amount, balanceAfter: user.walletBalance, description: "Wallet recharge via Razorpay", reason: "RECHARGE" },
    });
    return true;
  });

  if (credited) sendWalletNotification(app.fcm, app.prisma, recharge.userId, "CREDIT", recharge.amount.toNumber(), "Wallet recharge");
  const user = await app.prisma.user.findUniqueOrThrow({ where: { id: recharge.userId }, select: { walletBalance: true } });
  return { balance: Number(user.walletBalance) };
}
