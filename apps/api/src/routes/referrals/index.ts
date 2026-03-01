import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { applyReferralCodeSchema, createReferralConfigSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { ensureReferralCode } from "../../services/referral-code.js";

export async function referralRoutes(app: FastifyInstance) {
  // ── Customer: get referral info ────────────────────────
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };

    // Ensure user has a referral code
    const referralCode = await ensureReferralCode(app.prisma, sub);

    // Get referral list for this user (as referrer)
    const referrals = await app.prisma.referral.findMany({
      where: { referrerId: sub },
      include: {
        referee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Get applied referral (where this user is the referee)
    const appliedReferral = await app.prisma.referral.findFirst({
      where: { refereeId: sub },
      include: {
        referrer: { select: { id: true, name: true } },
      },
    });

    const completedCount = referrals.filter((r) => r.status === "COMPLETED").length;
    const totalEarned = referrals
      .filter((r) => r.status === "COMPLETED")
      .reduce((sum, r) => sum + Number(r.referrerReward), 0);

    return {
      success: true,
      data: {
        referralCode,
        stats: {
          totalReferrals: referrals.length,
          completedReferrals: completedCount,
          totalEarned,
        },
        referrals: referrals.map((r) => ({
          id: r.id,
          refereeName: r.referee.name || "New User",
          status: r.status,
          referrerReward: Number(r.referrerReward),
          refereeReward: Number(r.refereeReward),
          completedAt: r.completedAt,
          createdAt: r.createdAt,
        })),
        appliedReferral: appliedReferral
          ? {
              referrerName: appliedReferral.referrer.name || "User",
              status: appliedReferral.status,
              refereeReward: Number(appliedReferral.refereeReward),
            }
          : null,
      },
    } satisfies ApiResponse<any>;
  });

  // ── Customer: apply a referral code ────────────────────
  app.post("/apply", { preHandler: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const body = applyReferralCodeSchema.parse(request.body);

    // Find store to get organizationId
    const store = await app.prisma.store.findUnique({
      where: { id: body.storeId },
      select: { organizationId: true },
    });
    if (!store) return reply.notFound("Store not found");

    const orgId = store.organizationId;

    // Check if referral config is enabled for this org
    const config = await app.prisma.referralConfig.findUnique({
      where: { organizationId: orgId },
    });
    if (!config?.isEnabled) {
      return reply.badRequest("Referral program is not active for this organization");
    }

    // Find the referrer by code
    const referrer = await app.prisma.user.findUnique({
      where: { referralCode: body.code },
      select: { id: true },
    });
    if (!referrer) return reply.notFound("Invalid referral code");

    // Can't self-refer
    if (referrer.id === sub) {
      return reply.badRequest("You cannot use your own referral code");
    }

    // Check if user already has a referral in this org
    const existing = await app.prisma.referral.findUnique({
      where: { refereeId_organizationId: { refereeId: sub, organizationId: orgId } },
    });
    if (existing) {
      return reply.badRequest("You have already applied a referral code");
    }

    // Check user has zero DELIVERED orders in this org (first order hasn't happened yet)
    const deliveredCount = await app.prisma.order.count({
      where: { userId: sub, store: { organizationId: orgId }, status: "DELIVERED" },
    });
    if (deliveredCount > 0) {
      return reply.badRequest("Referral code can only be applied before your first delivered order");
    }

    // Check referrer hasn't exceeded max referrals
    const referrerCount = await app.prisma.referral.count({
      where: { referrerId: referrer.id, organizationId: orgId },
    });
    if (referrerCount >= config.maxReferralsPerUser) {
      return reply.badRequest("This referral code has reached its maximum usage limit");
    }

    const referral = await app.prisma.referral.create({
      data: {
        referrerId: referrer.id,
        refereeId: sub,
        organizationId: orgId,
        referrerReward: config.referrerReward,
        refereeReward: config.refereeReward,
        status: "PENDING",
      },
    });

    return {
      success: true,
      data: {
        id: referral.id,
        status: referral.status,
        refereeReward: Number(referral.refereeReward),
      },
    } satisfies ApiResponse<any>;
  });

  // ── Admin: get referral config ─────────────────────────
  app.get(
    "/config",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const orgUser = getOrgUser(request);
      let orgId = orgUser.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        if (!organizationId) return reply.badRequest("organizationId required");
        orgId = organizationId;
      }

      const config = await app.prisma.referralConfig.findUnique({
        where: { organizationId: orgId },
      });

      return {
        success: true,
        data: config
          ? {
              id: config.id,
              isEnabled: config.isEnabled,
              referrerReward: Number(config.referrerReward),
              refereeReward: Number(config.refereeReward),
              maxReferralsPerUser: config.maxReferralsPerUser,
            }
          : null,
      } satisfies ApiResponse<any>;
    },
  );

  // ── Admin: upsert referral config ──────────────────────
  app.put(
    "/config",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const orgUser = getOrgUser(request);
      let orgId = orgUser.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        if (!organizationId) return reply.badRequest("organizationId required");
        orgId = organizationId;
      }

      const body = createReferralConfigSchema.parse(request.body);

      const config = await app.prisma.referralConfig.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          ...body,
        },
        update: body,
      });

      return {
        success: true,
        data: {
          id: config.id,
          isEnabled: config.isEnabled,
          referrerReward: Number(config.referrerReward),
          refereeReward: Number(config.refereeReward),
          maxReferralsPerUser: config.maxReferralsPerUser,
        },
      } satisfies ApiResponse<any>;
    },
  );

  // ── Admin: list referrals ──────────────────────────────
  app.get(
    "/list",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const orgUser = getOrgUser(request);

      const { page = "1", pageSize = "10", search, status, organizationId: qOrgId } = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        status?: string;
        organizationId?: string;
      };

      const pg = Math.max(1, Number(page));
      const ps = Math.min(100, Math.max(1, Number(pageSize)));

      // ORG_ADMIN: scoped to their org. SUPER_ADMIN: all orgs (or filter by query param)
      const orgId = orgUser.organizationId ?? qOrgId;
      const where: any = orgId ? { organizationId: orgId } : {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { referrer: { name: { contains: search, mode: "insensitive" } } },
          { referrer: { email: { contains: search, mode: "insensitive" } } },
          { referee: { name: { contains: search, mode: "insensitive" } } },
          { referee: { email: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [referrals, total] = await Promise.all([
        app.prisma.referral.findMany({
          where,
          include: {
            referrer: { select: { id: true, name: true, email: true, referralCode: true } },
            referee: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (pg - 1) * ps,
          take: ps,
        }),
        app.prisma.referral.count({ where }),
      ]);

      return {
        success: true,
        data: referrals.map((r) => ({
          id: r.id,
          referrer: r.referrer,
          referee: r.referee,
          status: r.status,
          referrerReward: Number(r.referrerReward),
          refereeReward: Number(r.refereeReward),
          orderId: r.orderId,
          completedAt: r.completedAt,
          createdAt: r.createdAt,
        })),
        meta: {
          total,
          page: pg,
          pageSize: ps,
          totalPages: Math.ceil(total / ps),
        },
      } satisfies PaginatedResponse<any>;
    },
  );

  // ── Admin: referral stats ──────────────────────────────
  app.get(
    "/stats",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const orgUser = getOrgUser(request);
      const { organizationId: qOrgId } = request.query as { organizationId?: string };

      // ORG_ADMIN: scoped to their org. SUPER_ADMIN: all orgs (or filter by query param)
      const orgId = orgUser.organizationId ?? qOrgId;
      const orgFilter: any = orgId ? { organizationId: orgId } : {};

      const [totalReferrals, pendingReferrals, completedReferrals] = await Promise.all([
        app.prisma.referral.count({ where: orgFilter }),
        app.prisma.referral.count({ where: { ...orgFilter, status: "PENDING" } }),
        app.prisma.referral.count({ where: { ...orgFilter, status: "COMPLETED" } }),
      ]);

      const completedRows = await app.prisma.referral.findMany({
        where: { ...orgFilter, status: "COMPLETED" },
        select: { referrerReward: true, refereeReward: true },
      });

      const totalRewardsGiven = completedRows.reduce(
        (sum, r) => sum + Number(r.referrerReward) + Number(r.refereeReward),
        0,
      );

      return {
        success: true,
        data: {
          totalReferrals,
          pendingReferrals,
          completedReferrals,
          totalRewardsGiven,
          conversionRate: totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0,
        },
      } satisfies ApiResponse<any>;
    },
  );
}
