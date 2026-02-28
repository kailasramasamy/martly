import type { FastifyInstance } from "fastify";
import { createLoyaltyConfigSchema, updateLoyaltyConfigSchema, loyaltyAdjustmentSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { sendLoyaltyNotification } from "../../services/notification.js";

export async function loyaltyRoutes(app: FastifyInstance) {
  // GET /loyalty?storeId=X — Customer: balance, config, transactions (org resolved from storeId)
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    const { storeId } = request.query as { storeId?: string };

    if (!storeId) {
      return reply.badRequest("storeId query parameter is required");
    }

    // Resolve org from store
    const store = await app.prisma.store.findUnique({
      where: { id: storeId },
      select: { organizationId: true },
    });
    if (!store) return reply.notFound("Store not found");

    const organizationId = store.organizationId;

    const [config, balance, transactions] = await Promise.all([
      app.prisma.loyaltyConfig.findUnique({ where: { organizationId } }),
      app.prisma.loyaltyBalance.findUnique({
        where: { userId_organizationId: { userId: user.sub, organizationId } },
      }),
      app.prisma.loyaltyTransaction.findMany({
        where: { userId: user.sub, organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          points: true,
          balanceAfter: true,
          description: true,
          orderId: true,
          createdAt: true,
        },
      }),
    ]);

    const response: ApiResponse<{
      config: { isEnabled: boolean; earnRate: number; minRedeemPoints: number; maxRedeemPercentage: number } | null;
      balance: { points: number; totalEarned: number; totalRedeemed: number };
      transactions: typeof transactions;
    }> = {
      success: true,
      data: {
        config: config ? {
          isEnabled: config.isEnabled,
          earnRate: config.earnRate,
          minRedeemPoints: config.minRedeemPoints,
          maxRedeemPercentage: config.maxRedeemPercentage,
        } : null,
        balance: {
          points: balance?.points ?? 0,
          totalEarned: balance?.totalEarned ?? 0,
          totalRedeemed: balance?.totalRedeemed ?? 0,
        },
        transactions,
      },
    };
    return response;
  });

  // GET /loyalty/config — Admin: get org's loyalty config
  app.get(
    "/config",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const user = getOrgUser(request);
      if (!user.organizationId && user.role !== "SUPER_ADMIN") {
        return reply.forbidden("Organization context required");
      }

      // For SUPER_ADMIN without org context, require organizationId query param
      let orgId = user.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        if (!organizationId) return reply.badRequest("organizationId required");
        orgId = organizationId;
      }

      const config = await app.prisma.loyaltyConfig.findUnique({
        where: { organizationId: orgId },
      });

      const response: ApiResponse<typeof config> = {
        success: true,
        data: config ?? null as any,
      };
      return response;
    },
  );

  // PUT /loyalty/config — Admin: create/update org's loyalty config (upsert)
  app.put(
    "/config",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const user = getOrgUser(request);
      let orgId = user.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        if (!organizationId) return reply.badRequest("organizationId required");
        orgId = organizationId;
      }

      const body = createLoyaltyConfigSchema.parse(request.body);

      const config = await app.prisma.loyaltyConfig.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          isEnabled: body.isEnabled,
          earnRate: body.earnRate,
          minRedeemPoints: body.minRedeemPoints,
          maxRedeemPercentage: body.maxRedeemPercentage,
        },
        update: {
          isEnabled: body.isEnabled,
          earnRate: body.earnRate,
          minRedeemPoints: body.minRedeemPoints,
          maxRedeemPercentage: body.maxRedeemPercentage,
        },
      });

      const response: ApiResponse<typeof config> = { success: true, data: config };
      return response;
    },
  );

  // GET /loyalty/customers — Admin: paginated customer loyalty list
  app.get(
    "/customers",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const user = getOrgUser(request);
      const { page = 1, pageSize = 20, q } = request.query as {
        page?: number; pageSize?: number; q?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);

      let orgId = user.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        orgId = organizationId;
      }

      const where: Record<string, unknown> = {};
      if (orgId) where.organizationId = orgId;

      if (q) {
        where.user = {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        };
      }

      const [balances, total] = await Promise.all([
        app.prisma.loyaltyBalance.findMany({
          where,
          skip,
          take: Number(pageSize),
          orderBy: { points: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        }),
        app.prisma.loyaltyBalance.count({ where }),
      ]);

      const response: PaginatedResponse<(typeof balances)[0]> = {
        success: true,
        data: balances,
        meta: {
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      };
      return response;
    },
  );

  // GET /loyalty/customers/:userId — Admin: customer detail with transactions
  app.get<{ Params: { userId: string } }>(
    "/customers/:userId",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const user = getOrgUser(request);
      let orgId = user.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        orgId = organizationId;
      }
      if (!orgId) return reply.badRequest("organizationId required");

      const [balance, transactions] = await Promise.all([
        app.prisma.loyaltyBalance.findUnique({
          where: {
            userId_organizationId: {
              userId: request.params.userId,
              organizationId: orgId,
            },
          },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        }),
        app.prisma.loyaltyTransaction.findMany({
          where: { userId: request.params.userId, organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);

      const response: ApiResponse<{ balance: typeof balance; transactions: typeof transactions }> = {
        success: true,
        data: { balance, transactions },
      };
      return response;
    },
  );

  // POST /loyalty/adjust — Admin: manual point adjustment
  app.post(
    "/adjust",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const admin = getOrgUser(request);
      let orgId = admin.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        orgId = organizationId;
      }
      if (!orgId) return reply.badRequest("organizationId required");

      const body = loyaltyAdjustmentSchema.parse(request.body);

      const result = await app.prisma.$transaction(async (tx) => {
        // Upsert balance
        const existing = await tx.loyaltyBalance.findUnique({
          where: { userId_organizationId: { userId: body.userId, organizationId: orgId! } },
        });

        const currentPoints = existing?.points ?? 0;
        const newPoints = currentPoints + body.points;
        if (newPoints < 0) {
          throw Object.assign(new Error("Adjustment would result in negative balance"), { statusCode: 400 });
        }

        const balance = await tx.loyaltyBalance.upsert({
          where: { userId_organizationId: { userId: body.userId, organizationId: orgId! } },
          create: {
            userId: body.userId,
            organizationId: orgId!,
            points: Math.max(0, body.points),
            totalEarned: body.points > 0 ? body.points : 0,
            totalRedeemed: 0,
          },
          update: {
            points: { increment: body.points },
            ...(body.points > 0 ? { totalEarned: { increment: body.points } } : {}),
          },
        });

        const transaction = await tx.loyaltyTransaction.create({
          data: {
            userId: body.userId,
            organizationId: orgId!,
            type: "ADJUSTMENT",
            points: body.points,
            balanceAfter: balance.points,
            description: body.description,
          },
        });

        return { balance, transaction };
      });

      // Fire-and-forget: loyalty notification
      sendLoyaltyNotification(
        app.fcm, app.prisma, body.userId,
        body.points > 0 ? "EARN" : "REDEEM",
        Math.abs(body.points),
      );

      const response: ApiResponse<typeof result> = { success: true, data: result };
      return response;
    },
  );
}
