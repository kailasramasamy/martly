import type { FastifyInstance } from "fastify";
import { createReturnRequestSchema, resolveReturnRequestSchema } from "@martly/shared/schemas";
import { RETURN_WINDOW_HOURS } from "@martly/shared/constants";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds } from "../../middleware/org-scope.js";
import { sendWalletNotification } from "../../services/notification.js";

export async function returnRequestRoutes(app: FastifyInstance) {
  // ── POST / — Customer creates a return request ─────────────
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "CUSTOMER") return reply.forbidden("Only customers can create return requests");

    const body = createReturnRequestSchema.parse(request.body);

    // Fetch order with items
    const order = await app.prisma.order.findUnique({
      where: { id: body.orderId },
      include: { items: true, store: true, returnRequest: true },
    });

    if (!order) return reply.notFound("Order not found");
    if (order.userId !== user.sub) return reply.forbidden("This is not your order");
    if (order.status !== "DELIVERED") {
      return reply.badRequest("Return requests can only be submitted for delivered orders");
    }
    if (order.returnRequest) {
      return reply.badRequest("A return request already exists for this order");
    }

    // Check 48h window
    const deliveredAt = order.updatedAt;
    const hoursSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceDelivery > RETURN_WINDOW_HOURS) {
      return reply.badRequest(`Return window of ${RETURN_WINDOW_HOURS} hours has expired`);
    }

    // Validate items belong to order and quantities don't exceed
    const orderItemMap = new Map(order.items.map((i) => [i.id, i]));
    let requestedAmount = 0;
    for (const item of body.items) {
      const orderItem = orderItemMap.get(item.orderItemId);
      if (!orderItem) return reply.badRequest(`Order item ${item.orderItemId} not found in this order`);
      if (item.quantity > orderItem.quantity) {
        return reply.badRequest(`Quantity ${item.quantity} exceeds order quantity ${orderItem.quantity}`);
      }
      requestedAmount += (Number(orderItem.unitPrice) * item.quantity);
    }

    const returnRequest = await app.prisma.returnRequest.create({
      data: {
        orderId: body.orderId,
        userId: user.sub,
        organizationId: order.store.organizationId,
        storeId: order.storeId,
        reason: body.reason,
        description: body.description,
        images: body.imageUrls ?? [],
        requestedAmount,
        items: {
          create: body.items.map((i) => ({
            orderItemId: i.orderItemId,
            quantity: i.quantity,
          })),
        },
      },
      include: {
        items: { include: { orderItem: { include: { product: true, variant: true } } } },
      },
    });

    return { success: true, data: returnRequest } satisfies ApiResponse<typeof returnRequest>;
  });

  // ── GET /my-requests — Customer lists own return requests ──
  app.get("/my-requests", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);
    const { page = "1", pageSize = "20" } = request.query as { page?: string; pageSize?: string };
    const pg = Number(page);
    const ps = Number(pageSize);

    const where = { userId: user.sub };
    const [items, total] = await Promise.all([
      app.prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pg - 1) * ps,
        take: ps,
        include: {
          order: { select: { id: true, totalAmount: true, createdAt: true } },
          items: { include: { orderItem: { include: { product: true, variant: true } } } },
        },
      }),
      app.prisma.returnRequest.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: { total, page: pg, pageSize: ps, totalPages: Math.ceil(total / ps) },
    } satisfies PaginatedResponse<(typeof items)[0]>;
  });

  // ── GET /my-requests/:orderId — Customer checks request for specific order ──
  app.get<{ Params: { orderId: string } }>("/my-requests/:orderId", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);

    const returnRequest = await app.prisma.returnRequest.findUnique({
      where: { orderId: request.params.orderId },
      include: {
        items: { include: { orderItem: { include: { product: true, variant: true } } } },
      },
    });

    if (!returnRequest) return reply.notFound("No return request for this order");
    if (returnRequest.userId !== user.sub) return reply.forbidden("Not your return request");

    return { success: true, data: returnRequest } satisfies ApiResponse<typeof returnRequest>;
  });

  // ── GET / — Admin lists return requests (org-scoped) ───────
  app.get("/", { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] }, async (request) => {
    const user = getOrgUser(request);
    const { page = "1", pageSize = "20", status, storeId, search } = request.query as {
      page?: string; pageSize?: string; status?: string; storeId?: string; search?: string;
    };
    const pg = Number(page);
    const ps = Number(pageSize);

    const storeIds = await getOrgStoreIds(request, app.prisma);
    const where: any = {};
    if (storeIds) where.storeId = { in: storeIds };
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;
    if (search) {
      where.OR = [
        { order: { id: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      app.prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pg - 1) * ps,
        take: ps,
        include: {
          order: { select: { id: true, totalAmount: true, createdAt: true } },
          user: { select: { id: true, name: true, email: true, phone: true } },
          store: { select: { id: true, name: true } },
        },
      }),
      app.prisma.returnRequest.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: { total, page: pg, pageSize: ps, totalPages: Math.ceil(total / ps) },
    } satisfies PaginatedResponse<(typeof items)[0]>;
  });

  // ── GET /:id — Admin views return request detail ───────────
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] }, async (request, reply) => {
    const storeIds = await getOrgStoreIds(request, app.prisma);

    const returnRequest = await app.prisma.returnRequest.findUnique({
      where: { id: request.params.id },
      include: {
        order: { select: { id: true, totalAmount: true, createdAt: true, status: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        store: { select: { id: true, name: true } },
        items: { include: { orderItem: { include: { product: true, variant: true } } } },
      },
    });

    if (!returnRequest) return reply.notFound("Return request not found");
    if (storeIds && !storeIds.includes(returnRequest.storeId)) return reply.forbidden("Access denied");

    return { success: true, data: returnRequest } satisfies ApiResponse<typeof returnRequest>;
  });

  // ── PATCH /:id/resolve — Admin approves or rejects ─────────
  app.patch<{ Params: { id: string } }>("/:id/resolve", { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] }, async (request, reply) => {
    const user = getOrgUser(request);
    const body = resolveReturnRequestSchema.parse(request.body);

    const returnRequest = await app.prisma.returnRequest.findUnique({
      where: { id: request.params.id },
      include: { order: true },
    });

    if (!returnRequest) return reply.notFound("Return request not found");
    if (returnRequest.status !== "PENDING") {
      return reply.badRequest("Return request has already been resolved");
    }

    // Org-scope check
    if (user.role !== "SUPER_ADMIN" && user.organizationId !== returnRequest.organizationId) {
      return reply.forbidden("Access denied");
    }

    if (body.status === "APPROVED") {
      const approvedAmount = body.approvedAmount ?? Number(returnRequest.requestedAmount);

      const result = await app.prisma.$transaction(async (tx) => {
        const updated = await tx.returnRequest.update({
          where: { id: request.params.id },
          data: {
            status: "APPROVED",
            approvedAmount,
            adminNote: body.adminNote,
            resolvedAt: new Date(),
            resolvedBy: user.sub,
          },
        });

        // Wallet refund
        const updatedUser = await tx.user.update({
          where: { id: returnRequest.userId },
          data: { walletBalance: { increment: approvedAmount } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: returnRequest.userId,
            orderId: returnRequest.orderId,
            type: "CREDIT",
            amount: approvedAmount,
            balanceAfter: Number(updatedUser.walletBalance),
            description: `Refund for return request on order #${returnRequest.orderId.slice(0, 8)}`,
          },
        });

        return updated;
      });

      // Fire-and-forget notification
      sendWalletNotification(
        app.fcm,
        app.prisma,
        returnRequest.userId,
        "CREDIT",
        approvedAmount,
        `Refund approved for order #${returnRequest.orderId.slice(0, 8)}`,
      );

      return { success: true, data: result } satisfies ApiResponse<typeof result>;
    } else {
      // REJECTED
      if (!body.adminNote) return reply.badRequest("Admin note is required when rejecting");

      const updated = await app.prisma.returnRequest.update({
        where: { id: request.params.id },
        data: {
          status: "REJECTED",
          adminNote: body.adminNote,
          resolvedAt: new Date(),
          resolvedBy: user.sub,
        },
      });

      return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
    }
  });
}
