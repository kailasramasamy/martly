import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import {
  createMembershipPlanSchema,
  updateMembershipPlanSchema,
  purchaseMembershipSchema,
  upgradeMembershipSchema,
  verifyPaymentSchema,
} from "@martly/shared/schemas";
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  verifyRazorpaySignature,
  ensureRazorpayCustomer,
} from "../../services/payment.js";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";

const DURATION_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  ANNUAL: 365,
};

export async function membershipRoutes(app: FastifyInstance) {
  // ── Customer: list plans + active membership ───────
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) throw Object.assign(new Error("storeId query param required"), { statusCode: 400 });

    const store = await app.prisma.store.findUnique({ where: { id: storeId }, select: { organizationId: true } });
    if (!store) throw Object.assign(new Error("Store not found"), { statusCode: 404 });

    const user = getOrgUser(request);

    const [plans, activeMembership] = await Promise.all([
      app.prisma.membershipPlan.findMany({
        where: { organizationId: store.organizationId, isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      app.prisma.userMembership.findFirst({
        where: {
          userId: user.sub,
          organizationId: store.organizationId,
          status: "ACTIVE",
          endDate: { gt: new Date() },
        },
        include: { plan: true },
        orderBy: { endDate: "desc" },
      }),
    ]);

    // Compute upgrade options if user has an active membership
    let upgradeOptions: { plan: Record<string, unknown>; credit: number; upgradeCharge: number; isFree: boolean }[] = [];
    if (activeMembership) {
      const now = new Date();
      const daysLeft = Math.max(0, Math.ceil((activeMembership.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const totalDays = DURATION_DAYS[activeMembership.plan.duration] ?? 30;
      const pricePaid = Number(activeMembership.pricePaid);
      const credit = Math.round((daysLeft / totalDays) * pricePaid * 100) / 100;

      const higherPlans = plans.filter((p) => p.sortOrder > activeMembership.plan.sortOrder);
      upgradeOptions = higherPlans.map((plan) => {
        const planPrice = Number(plan.price);
        const charge = Math.max(0, Math.round((planPrice - credit) * 100) / 100);
        return {
          plan: { ...plan, price: planPrice },
          credit: Number(credit.toFixed(2)),
          upgradeCharge: Number(charge.toFixed(2)),
          isFree: charge < 1,
        };
      });
    }

    return {
      success: true,
      data: {
        plans: plans.map((p) => ({
          ...p,
          price: Number(p.price),
        })),
        activeMembership: activeMembership
          ? {
              ...activeMembership,
              pricePaid: Number(activeMembership.pricePaid),
              plan: { ...activeMembership.plan, price: Number(activeMembership.plan.price) },
            }
          : null,
        upgradeOptions,
      },
    } satisfies ApiResponse<unknown>;
  });

  // ── Customer: lightweight status check ─────────────
  app.get("/status", { preHandler: [authenticate] }, async (request) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) throw Object.assign(new Error("storeId query param required"), { statusCode: 400 });

    const store = await app.prisma.store.findUnique({ where: { id: storeId }, select: { organizationId: true } });
    if (!store) throw Object.assign(new Error("Store not found"), { statusCode: 404 });

    const user = getOrgUser(request);
    const membership = await app.prisma.userMembership.findFirst({
      where: {
        userId: user.sub,
        organizationId: store.organizationId,
        status: "ACTIVE",
        endDate: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { endDate: "desc" },
    });

    return {
      success: true,
      data: {
        isMember: !!membership,
        membership: membership
          ? {
              planName: membership.plan.name,
              endDate: membership.endDate,
              freeDelivery: membership.plan.freeDelivery,
              loyaltyMultiplier: membership.plan.loyaltyMultiplier,
            }
          : null,
      },
    } satisfies ApiResponse<unknown>;
  });

  // ── Customer: purchase membership ──────────────────
  app.post("/purchase", { preHandler: [authenticate] }, async (request) => {
    const body = purchaseMembershipSchema.parse(request.body);
    const user = getOrgUser(request);

    const store = await app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } });
    if (!store) throw Object.assign(new Error("Store not found"), { statusCode: 404 });

    const plan = await app.prisma.membershipPlan.findFirst({
      where: { id: body.planId, organizationId: store.organizationId, isActive: true },
    });
    if (!plan) throw Object.assign(new Error("Membership plan not found"), { statusCode: 404 });

    // Check no existing active membership
    const existing = await app.prisma.userMembership.findFirst({
      where: {
        userId: user.sub,
        organizationId: store.organizationId,
        status: "ACTIVE",
        endDate: { gt: new Date() },
      },
    });
    if (existing) throw Object.assign(new Error("You already have an active membership"), { statusCode: 400 });

    const amountInPaise = Math.round(Number(plan.price) * 100);
    const receiptId = `mem_${user.sub.slice(0, 8)}_${Date.now()}`;

    const customerId = await ensureRazorpayCustomer(app.prisma, user.sub);
    const rpOrder = await createRazorpayOrder(amountInPaise, receiptId, customerId);

    return {
      success: true,
      data: {
        razorpay_order_id: rpOrder.id,
        amount: amountInPaise,
        currency: "INR",
        key_id: getRazorpayKeyId(),
        planId: plan.id,
        ...(customerId ? { customer_id: customerId } : {}),
      },
    } satisfies ApiResponse<unknown>;
  });

  // ── Customer: upgrade membership ──────────────────
  app.post("/upgrade", { preHandler: [authenticate] }, async (request) => {
    const body = upgradeMembershipSchema.parse(request.body);
    const user = getOrgUser(request);

    const store = await app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } });
    if (!store) throw Object.assign(new Error("Store not found"), { statusCode: 404 });

    // Find active membership
    const activeMembership = await app.prisma.userMembership.findFirst({
      where: {
        userId: user.sub,
        organizationId: store.organizationId,
        status: "ACTIVE",
        endDate: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { endDate: "desc" },
    });
    if (!activeMembership) throw Object.assign(new Error("No active membership to upgrade"), { statusCode: 400 });

    // Find target plan
    const targetPlan = await app.prisma.membershipPlan.findFirst({
      where: { id: body.planId, organizationId: store.organizationId, isActive: true },
    });
    if (!targetPlan) throw Object.assign(new Error("Target plan not found"), { statusCode: 404 });
    if (targetPlan.sortOrder <= activeMembership.plan.sortOrder) {
      throw Object.assign(new Error("Can only upgrade to a higher plan"), { statusCode: 400 });
    }

    // Compute proration
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((activeMembership.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = DURATION_DAYS[activeMembership.plan.duration] ?? 30;
    const pricePaid = Number(activeMembership.pricePaid);
    const credit = Math.round((daysLeft / totalDays) * pricePaid * 100) / 100;
    const upgradeCharge = Math.max(0, Math.round((Number(targetPlan.price) - credit) * 100) / 100);

    if (upgradeCharge < 1) {
      // Free upgrade — activate directly
      const days = DURATION_DAYS[targetPlan.duration] ?? 30;
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const membership = await app.prisma.$transaction(async (tx) => {
        await tx.userMembership.update({
          where: { id: activeMembership.id },
          data: { status: "CANCELLED" },
        });
        return tx.userMembership.create({
          data: {
            userId: user.sub,
            planId: targetPlan.id,
            organizationId: store.organizationId,
            status: "ACTIVE",
            startDate: now,
            endDate,
            pricePaid: 0,
            previousMembershipId: activeMembership.id,
          },
          include: { plan: true },
        });
      });

      return {
        success: true,
        data: {
          upgraded: true,
          membership: {
            ...membership,
            pricePaid: Number(membership.pricePaid),
            plan: { ...membership.plan, price: Number(membership.plan.price) },
          },
        },
      } satisfies ApiResponse<unknown>;
    }

    // Paid upgrade — create Razorpay order
    const amountInPaise = Math.round(upgradeCharge * 100);
    const receiptId = `mem_upg_${user.sub.slice(0, 8)}_${Date.now()}`;
    const customerId = await ensureRazorpayCustomer(app.prisma, user.sub);
    const rpOrder = await createRazorpayOrder(amountInPaise, receiptId, customerId);

    return {
      success: true,
      data: {
        upgraded: false,
        razorpay_order_id: rpOrder.id,
        amount: amountInPaise,
        currency: "INR",
        key_id: getRazorpayKeyId(),
        planId: targetPlan.id,
        previousMembershipId: activeMembership.id,
        amountPaid: upgradeCharge,
        ...(customerId ? { customer_id: customerId } : {}),
      },
    } satisfies ApiResponse<unknown>;
  });

  // ── Customer: verify membership payment ────────────
  app.post("/verify", { preHandler: [authenticate] }, async (request) => {
    const body = verifyPaymentSchema.parse(request.body);
    const user = getOrgUser(request);

    const isValid = verifyRazorpaySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    );
    if (!isValid) throw Object.assign(new Error("Payment verification failed"), { statusCode: 400 });

    const { planId, previousMembershipId, amountPaid } = request.query as {
      planId?: string;
      previousMembershipId?: string;
      amountPaid?: string;
    };
    if (!planId) throw Object.assign(new Error("planId query param required"), { statusCode: 400 });

    const plan = await app.prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan) throw Object.assign(new Error("Plan not found"), { statusCode: 404 });

    const now = new Date();
    const days = DURATION_DAYS[plan.duration] ?? 30;
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    if (previousMembershipId) {
      // Upgrade path — cancel previous, create new with link
      const membership = await app.prisma.$transaction(async (tx) => {
        await tx.userMembership.update({
          where: { id: previousMembershipId },
          data: { status: "CANCELLED" },
        });
        return tx.userMembership.create({
          data: {
            userId: user.sub,
            planId: plan.id,
            organizationId: plan.organizationId,
            status: "ACTIVE",
            startDate: now,
            endDate,
            pricePaid: amountPaid ? Number(amountPaid) : plan.price,
            razorpayOrderId: body.razorpay_order_id,
            razorpayPaymentId: body.razorpay_payment_id,
            previousMembershipId,
          },
          include: { plan: true },
        });
      });

      return {
        success: true,
        data: {
          ...membership,
          pricePaid: Number(membership.pricePaid),
          plan: { ...membership.plan, price: Number(membership.plan.price) },
        },
      } satisfies ApiResponse<unknown>;
    }

    // New purchase path
    const membership = await app.prisma.userMembership.create({
      data: {
        userId: user.sub,
        planId: plan.id,
        organizationId: plan.organizationId,
        status: "ACTIVE",
        startDate: now,
        endDate,
        pricePaid: plan.price,
        razorpayOrderId: body.razorpay_order_id,
        razorpayPaymentId: body.razorpay_payment_id,
      },
      include: { plan: true },
    });

    return {
      success: true,
      data: {
        ...membership,
        pricePaid: Number(membership.pricePaid),
        plan: { ...membership.plan, price: Number(membership.plan.price) },
      },
    } satisfies ApiResponse<unknown>;
  });

  // ── Admin: list plans ──────────────────────────────
  app.get("/plans", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);
    const { page = "1", pageSize = "20" } = request.query as { page?: string; pageSize?: string };

    const where = user.role === "SUPER_ADMIN" ? {} : { organizationId: user.organizationId! };

    const [plans, total] = await Promise.all([
      app.prisma.membershipPlan.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: { organization: { select: { name: true } } },
      }),
      app.prisma.membershipPlan.count({ where }),
    ]);

    return {
      success: true,
      data: plans.map((p) => ({ ...p, price: Number(p.price) })),
      meta: {
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    } satisfies PaginatedResponse<unknown>;
  });

  // ── Admin: create plan ─────────────────────────────
  app.post("/plans", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "SUPER_ADMIN" && user.role !== "ORG_ADMIN") {
      return reply.forbidden("Only admins can create membership plans");
    }

    const body = createMembershipPlanSchema.parse(request.body);
    const organizationId = user.role === "SUPER_ADMIN"
      ? (request.body as { organizationId?: string }).organizationId
      : user.organizationId;

    if (!organizationId) throw Object.assign(new Error("organizationId required"), { statusCode: 400 });

    const plan = await app.prisma.membershipPlan.create({
      data: { ...body, organizationId },
    });

    return { success: true, data: { ...plan, price: Number(plan.price) } } satisfies ApiResponse<unknown>;
  });

  // ── Admin: update plan ─────────────────────────────
  app.put<{ Params: { id: string } }>("/plans/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "SUPER_ADMIN" && user.role !== "ORG_ADMIN") {
      return reply.forbidden("Only admins can update membership plans");
    }

    const body = updateMembershipPlanSchema.parse(request.body);
    const existing = await app.prisma.membershipPlan.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Plan not found");

    if (user.role !== "SUPER_ADMIN" && existing.organizationId !== user.organizationId) {
      return reply.forbidden("Not your organization's plan");
    }

    const plan = await app.prisma.membershipPlan.update({
      where: { id: request.params.id },
      data: body,
    });

    return { success: true, data: { ...plan, price: Number(plan.price) } } satisfies ApiResponse<unknown>;
  });

  // ── Admin: soft-delete plan ────────────────────────
  app.delete<{ Params: { id: string } }>("/plans/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "SUPER_ADMIN" && user.role !== "ORG_ADMIN") {
      return reply.forbidden("Only admins can delete membership plans");
    }

    const existing = await app.prisma.membershipPlan.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Plan not found");

    if (user.role !== "SUPER_ADMIN" && existing.organizationId !== user.organizationId) {
      return reply.forbidden("Not your organization's plan");
    }

    await app.prisma.membershipPlan.update({
      where: { id: request.params.id },
      data: { isActive: false },
    });

    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  // ── Admin: list subscribers ────────────────────────
  app.get("/subscribers", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "SUPER_ADMIN" && user.role !== "ORG_ADMIN") {
      return reply.forbidden("Only admins can view subscribers");
    }

    const { page = "1", pageSize = "20", search } = request.query as { page?: string; pageSize?: string; search?: string };

    const where: Record<string, unknown> = user.role === "SUPER_ADMIN" ? {} : { organizationId: user.organizationId! };
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [memberships, total] = await Promise.all([
      app.prisma.userMembership.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          plan: { select: { name: true, duration: true } },
        },
      }),
      app.prisma.userMembership.count({ where }),
    ]);

    return {
      success: true,
      data: memberships.map((m) => ({ ...m, pricePaid: Number(m.pricePaid) })),
      meta: {
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    } satisfies PaginatedResponse<unknown>;
  });
}
