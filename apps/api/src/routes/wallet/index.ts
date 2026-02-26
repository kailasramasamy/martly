import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

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
}
