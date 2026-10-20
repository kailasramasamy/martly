import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import {
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from "../../services/payment.js";
import { sendWalletNotification } from "../../services/notification.js";
import { createRecharge, settleRecharge } from "../../services/wallet-recharge.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { type FundedBy, goodwillPayer } from "../../services/ledger/goodwill.js";
import { postEntries } from "../../services/ledger/post.js";
import { formatOrderRef } from "../../services/notify/copy.js";

export async function walletRoutes(app: FastifyInstance) {
  async function customerInOrg(request: FastifyRequest, userId: string): Promise<boolean> {
    const user = getOrgUser(request);
    if (user.role === "SUPER_ADMIN") return true;
    const ordered = await app.prisma.order.findFirst({
      where: { userId, store: { organizationId: user.organizationId } },
      select: { id: true },
    });
    return !!ordered;
  }

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
          reason: true,
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

      const { razorpayOrderId, amountInPaise, customerId } = await createRecharge(app, user.sub, amount);

      return {
        success: true,
        data: {
          razorpay_order_id: razorpayOrderId,
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
    };
  }>(
    "/recharge/verify",
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as { sub: string };
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = request.body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        throw Object.assign(new Error("Missing payment verification fields"), { statusCode: 400 });
      }
      if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        throw Object.assign(new Error("Invalid payment signature"), { statusCode: 400 });
      }

      // The credited amount is the one recorded when the top-up was created, never the client's
      const settled = await settleRecharge(app, razorpay_order_id, razorpay_payment_id, user.sub);
      if (!settled) throw Object.assign(new Error("Recharge not found"), { statusCode: 404 });

      return { success: true, data: settled } satisfies ApiResponse<{ balance: number }>;
    },
  );

  // Admin: Get wallet balance + transactions for a specific user
  app.get<{ Params: { userId: string } }>(
    "/admin/:userId",
    { preHandler: [authenticate, requirePermission(Permission.REFUNDS_ISSUE)] },
    async (request, reply) => {
      const { userId } = request.params;
      if (!(await customerInOrg(request, userId))) return reply.forbidden("Access denied");

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
            reason: true,
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
    { preHandler: [authenticate, requirePermission(Permission.REFUNDS_ISSUE)] },
    async (request, reply) => {
      const { userId } = request.params;
      if (!(await customerInOrg(request, userId))) return reply.forbidden("Access denied");
      const { type, amount, description, orderId, fundedBy } = request.body as {
        type: "CREDIT" | "DEBIT";
        amount: number;
        description?: string;
        orderId?: string;
        fundedBy?: FundedBy;
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
      const payer = await goodwillPayer(app.prisma, getOrgUser(request), userId, { orderId, fundedBy });
      const note = description || "Balance adjusted by support";

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

        const txn = await tx.walletTransaction.create({
          data: {
            userId,
            type,
            amount,
            balanceAfter: updatedUser.walletBalance,
            description: note,
            reason: "SUPPORT",
            orderId: payer?.orderId,
            organizationId: payer?.organizationId,
            storeId: payer?.storeId,
          },
        });
        // A credit the organization funds comes off its balance; taking credit back returns it
        if (payer) {
          const onOrder = payer.orderId ? ` · order ${formatOrderRef(payer.orderId)}` : "";
          await postEntries(tx, [{
            ...payer, type: "GOODWILL_DEBIT", amount: type === "CREDIT" ? -amount : amount,
            sourceType: "WALLET_TXN", sourceId: txn.id, memo: `Support wallet ${type === "CREDIT" ? "credit" : "debit"}: ${note}${onOrder}`,
            createdBy: request.user.sub,
          }]);
        }

        return updatedUser;
      });

      sendWalletNotification(app.fcm, app.prisma, userId, type, amount, note);

      return {
        success: true,
        data: { balance: Number(result.walletBalance) },
      } satisfies ApiResponse<{ balance: number }>;
    },
  );
}
