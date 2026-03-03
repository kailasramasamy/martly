import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import {
  createRazorpayOrder,
  ensureRazorpayCustomer,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from "../../services/payment.js";
import { sendWalletNotification } from "../../services/notification.js";

export async function walletRoutes(app: FastifyInstance) {
  // Get wallet balance + recent transactions
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };

    const [userData, transactions] = await Promise.all([
      app.prisma.user.findUnique({
        where: { id: user.sub },
        select: { walletBalance: true },
      }),
      app.prisma.walletTransaction.findMany({
        where: { userId: user.sub },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          orderId: true,
          createdAt: true,
        },
      }),
    ]);

    const response: ApiResponse<{
      balance: number;
      transactions: typeof transactions;
    }> = {
      success: true,
      data: {
        balance: Number(userData?.walletBalance ?? 0),
        transactions,
      },
    };
    return response;
  });

  // Create Razorpay order for wallet recharge
  app.post<{ Body: { amount: number } }>(
    "/recharge",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { amount } = request.body ?? {} as { amount?: number };

      if (!amount || amount < 1 || amount > 50000) {
        throw Object.assign(new Error("Amount must be between 1 and 50000"), { statusCode: 400 });
      }

      if (!isRazorpayConfigured()) {
        throw Object.assign(new Error("Payment gateway not configured"), { statusCode: 503 });
      }

      const customerId = await ensureRazorpayCustomer(app.prisma, user.sub);
      const amountInPaise = Math.round(amount * 100);
      const receipt = `w_${user.sub.slice(0, 8)}_${Date.now()}`;
      const rpOrder = await createRazorpayOrder(amountInPaise, receipt, customerId);

      return {
        success: true,
        data: {
          razorpay_order_id: rpOrder.id,
          amount: amountInPaise,
          currency: "INR",
          key_id: getRazorpayKeyId(),
          customer_id: customerId,
        },
      } satisfies ApiResponse<{
        razorpay_order_id: string;
        amount: number;
        currency: string;
        key_id: string;
        customer_id: string;
      }>;
    },
  );

  // Verify Razorpay payment and credit wallet
  app.post<{
    Body: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
      amount: number;
    };
  }>(
    "/recharge/verify",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = request.body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !amount) {
        throw Object.assign(new Error("Missing payment verification fields"), { statusCode: 400 });
      }

      const valid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!valid) {
        throw Object.assign(new Error("Invalid payment signature"), { statusCode: 400 });
      }

      const creditAmount = amount / 100; // paise → rupees

      const updated = await app.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user.sub },
          data: { walletBalance: { increment: creditAmount } },
          select: { walletBalance: true },
        });

        await tx.walletTransaction.create({
          data: {
            userId: user.sub,
            type: "CREDIT",
            amount: creditAmount,
            balanceAfter: updatedUser.walletBalance,
            description: `Wallet recharge via Razorpay`,
          },
        });

        return updatedUser;
      });

      return {
        success: true,
        data: { balance: Number(updated.walletBalance) },
      } satisfies ApiResponse<{ balance: number }>;
    },
  );

  // Admin: Get wallet balance + transactions for a specific user
  app.get<{ Params: { userId: string } }>(
    "/admin/:userId",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { userId } = request.params;

      const [userData, transactions] = await Promise.all([
        app.prisma.user.findUnique({
          where: { id: userId },
          select: { walletBalance: true },
        }),
        app.prisma.walletTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            description: true,
            orderId: true,
            createdAt: true,
          },
        }),
      ]);

      if (!userData) return reply.notFound("User not found");

      return {
        success: true,
        data: {
          balance: Number(userData.walletBalance),
          transactions,
        },
      } satisfies ApiResponse<{ balance: number; transactions: typeof transactions }>;
    },
  );

  // Admin: Credit or debit a user's wallet
  app.post<{ Params: { userId: string } }>(
    "/admin/:userId/adjust",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { userId } = request.params;
      const { type, amount, description } = request.body as {
        type: "CREDIT" | "DEBIT";
        amount: number;
        description?: string;
      };

      if (!type || !["CREDIT", "DEBIT"].includes(type)) {
        return reply.badRequest("type must be CREDIT or DEBIT");
      }
      if (!amount || amount <= 0 || amount > 100000) {
        return reply.badRequest("amount must be between 1 and 100000");
      }

      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      });
      if (!user) return reply.notFound("User not found");

      if (type === "DEBIT" && Number(user.walletBalance) < amount) {
        return reply.badRequest(`Insufficient balance. Current balance: \u20B9${Number(user.walletBalance).toFixed(0)}`);
      }

      const result = await app.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            walletBalance: type === "CREDIT"
              ? { increment: amount }
              : { decrement: amount },
          },
          select: { walletBalance: true },
        });

        await tx.walletTransaction.create({
          data: {
            userId,
            type,
            amount,
            balanceAfter: updatedUser.walletBalance,
            description: description || `Admin ${type.toLowerCase()} adjustment`,
          },
        });

        return updatedUser;
      });

      sendWalletNotification(app.fcm, app.prisma, userId, type, amount, description || `Admin ${type.toLowerCase()} adjustment`);

      return {
        success: true,
        data: { balance: Number(result.walletBalance) },
      } satisfies ApiResponse<{ balance: number }>;
    },
  );
}
