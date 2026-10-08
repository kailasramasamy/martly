import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/index.js";

const IN_PROGRESS_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

export async function assertNoOrdersInProgress(prisma: FastifyInstance["prisma"], userId: string) {
  const active = await prisma.order.count({ where: { userId, status: { in: [...IN_PROGRESS_STATUSES] } } });
  if (active > 0) {
    throw httpError(409, "You have an order in progress. You can delete your account once it is delivered or cancelled.");
  }
}

/** Personal data with no record-keeping value is deleted outright. */
async function deletePersonalData(tx: Prisma.TransactionClient, userId: string, phone: string | null) {
  await tx.userAddress.deleteMany({ where: { userId } });
  await tx.deviceToken.deleteMany({ where: { userId } });
  await tx.wishlistItem.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });
  await tx.basketAddOn.deleteMany({ where: { userId } });
  await tx.loyaltyBalance.deleteMany({ where: { userId } });
  if (phone) await tx.otpCode.deleteMany({ where: { phone } });
}

/** Orders, payments and their history are kept for tax/accounting, minus the customer's personal details. */
async function anonymiseRecords(tx: Prisma.TransactionClient, userId: string) {
  await tx.order.updateMany({
    where: { userId },
    data: { deliveryAddress: null, deliveryLat: null, deliveryLng: null, deliveryNotes: null },
  });
  await tx.subscription.updateMany({
    where: { userId },
    data: { status: "CANCELLED", deliveryAddress: "", deliveryLat: null, deliveryLng: null, addressId: null },
  });
  await tx.userMembership.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
  await tx.supportTicket.updateMany({ where: { userId }, data: { messages: [] } });
}

async function forfeitWallet(tx: Prisma.TransactionClient, userId: string, balance: Prisma.Decimal) {
  if (balance.lte(0)) return;
  await tx.walletTransaction.create({
    data: { userId, type: "DEBIT", amount: balance, balanceAfter: 0, description: "Forfeited on account deletion" },
  });
}

/**
 * Deletes a customer's account: personal data is erased or anonymised, order records are kept,
 * and the user row is marked deleted so it can no longer sign in or refresh tokens.
 */
export async function deleteCustomerAccount(prisma: FastifyInstance["prisma"], userId: string) {
  await assertNoOrdersInProgress(prisma, userId);

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await deletePersonalData(tx, userId, user.phone);
    await anonymiseRecords(tx, userId);
    await forfeitWallet(tx, userId, user.walletBalance);
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        email: `deleted-${userId}@deleted.martly.app`,
        phone: null,
        passwordHash,
        walletBalance: 0,
        referralCode: null,
        razorpayCustomerId: null,
        preferredPaymentMethod: null,
        lastUpiVpa: null,
        deletedAt: new Date(),
      },
    });
  });
}
