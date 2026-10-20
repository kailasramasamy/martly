import type { FastifyInstance, FastifyRequest } from "fastify";
import { chooseReturnMethodSchema, collectReturnSchema, createReturnRequestSchema, resolveReturnRequestSchema } from "@martly/shared/schemas";
import { deliveredAt } from "@martly/shared/order-flow";
import { RETURN_WINDOW_HOURS } from "@martly/shared/constants";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { notifyReturnRequested } from "../../services/notify/service-alerts.js";
import { notifyReturnUpdate } from "../../services/notify/return-alerts.js";
import { resolveReturn } from "../../services/returns/resolve.js";
import { loadReturn, receiveReturn } from "../../services/returns/settle.js";
import { collectDenial } from "../../services/returns/pickups.js";

export async function returnRequestRoutes(app: FastifyInstance) {
  // ── POST / — Customer creates a return request ─────────────
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (user.role !== "CUSTOMER") return reply.forbidden("Only customers can create return requests");

    const body = createReturnRequestSchema.parse(request.body);

    // Fetch order with items
    const order = await app.prisma.order.findUnique({
      where: { id: body.orderId },
      include: { items: true, store: true, returnRequest: true, statusLogs: { select: { status: true, createdAt: true } } },
    });

    if (!order) return reply.notFound("Order not found");
    if (order.userId !== user.sub) return reply.forbidden("This is not your order");
    if (order.status !== "DELIVERED") {
      return reply.badRequest("Return requests can only be submitted for delivered orders");
    }
    if (order.returnRequest) {
      return reply.badRequest("A return request already exists for this order");
    }
    // Cash goes back only where cash (or UPI to the store) was collected; wallet-paid orders refund to the wallet
    if (body.refundTo === "CASH" && (order.paymentMethod !== "COD" || order.codCollectedVia === null)) {
      return reply.badRequest("Cash refunds are only for orders paid in cash on delivery");
    }

    const delivered = deliveredAt(order.statusLogs) ?? order.updatedAt;
    const hoursSinceDelivery = (Date.now() - delivered.getTime()) / (1000 * 60 * 60);
    if (hoursSinceDelivery > RETURN_WINDOW_HOURS) {
      return reply.badRequest(`Return window of ${RETURN_WINDOW_HOURS} hours has expired`);
    }

    // Validate items belong to order and quantities don't exceed
    const orderItemMap = new Map(order.items.map((i) => [i.id, i]));
    let requestedAmount = 0;
    for (const item of body.items) {
      const orderItem = orderItemMap.get(item.orderItemId);
      if (!orderItem) return reply.badRequest(`Order item ${item.orderItemId} not found in this order`);
      const kept = orderItem.quantity - orderItem.refusedQuantity;
      if (item.quantity > kept) {
        return reply.badRequest(`Quantity ${item.quantity} exceeds the ${kept} delivered`);
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
        refundTo: body.refundTo,
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

    notifyReturnRequested(app.fcm, app.prisma, {
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      userId: user.sub,
      storeId: order.storeId,
      requestedAmount,
      itemCount: body.items.length,
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
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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

  // ── GET /my-replacements — Customer's replacements that will ride on their next order at a store ──
  app.get<{ Querystring: { storeId?: string } }>("/my-replacements", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (!request.query.storeId) return reply.badRequest("storeId is required");
    const pending = await app.prisma.returnRequest.findMany({
      where: {
        userId: user.sub, storeId: request.query.storeId, status: "IN_PROGRESS", remedy: "REPLACE",
        replacementItems: { none: { order: { status: { not: "CANCELLED" } } } },
      },
      select: {
        id: true, orderId: true, reason: true,
        items: {
          select: {
            quantity: true,
            orderItem: {
              select: {
                unitPrice: true,
                product: { select: { name: true, imageUrl: true, images: true } },
                variant: { select: { name: true, imageUrl: true } },
              },
            },
          },
        },
      },
    });
    return { success: true, data: pending } satisfies ApiResponse<typeof pending>;
  });

  // ── GET /my-requests/:orderId — Customer checks request for specific order ──
  app.get<{ Params: { orderId: string } }>("/my-requests/:orderId", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);

    const returnRequest = await app.prisma.returnRequest.findUnique({
      where: { orderId: request.params.orderId },
      include: {
        items: { include: { orderItem: { include: { product: true, variant: true } } } },
        store: { select: { name: true, address: true, phone: true } },
      },
    });

    if (!returnRequest) return reply.notFound("No return request for this order");
    if (returnRequest.userId !== user.sub) return reply.forbidden("Not your return request");

    return { success: true, data: returnRequest } satisfies ApiResponse<typeof returnRequest>;
  });

  // ── GET / — Admin lists return requests (org-scoped) ───────
  app.get("/", { preHandler: [authenticate, requirePermission(Permission.ORDERS_VIEW, Permission.RETURNS_HANDLE)] }, async (request, reply) => {
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
    if (storeId) {
      if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
      where.storeId = storeId;
    }
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
        // Latest activity first: a return that was just approved, collected or received rises to the top
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
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
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate, requirePermission(Permission.ORDERS_VIEW, Permission.RETURNS_HANDLE)] }, async (request, reply) => {
    const storeIds = await getOrgStoreIds(request, app.prisma);

    const returnRequest = await app.prisma.returnRequest.findUnique({
      where: { id: request.params.id },
      include: {
        order: { select: { id: true, totalAmount: true, createdAt: true, status: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        store: { select: { id: true, name: true, returnKeepThreshold: true } },
        items: { include: { orderItem: { include: { product: true, variant: true } } } },
        replacementItems: { select: { orderId: true, order: { select: { status: true } } } },
      },
    });

    if (!returnRequest) return reply.notFound("Return request not found");
    if (storeIds && !storeIds.includes(returnRequest.storeId)) return reply.forbidden("Access denied");

    // Who took the item back: the rider who collected it, or the staff member at the counter
    const receiver = returnRequest.receivedBy
      ? await app.prisma.user.findUnique({ where: { id: returnRequest.receivedBy }, select: { id: true, name: true, phone: true, role: true } })
      : null;
    const data = { ...returnRequest, receiver };
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // ── PATCH /:id/resolve — Staff approve (remedy + return method) or reject ─────────
  app.patch<{ Params: { id: string } }>("/:id/resolve", { preHandler: [authenticate, requirePermission(Permission.RETURNS_HANDLE)] }, async (request, reply) => {
    const user = getOrgUser(request);
    const body = resolveReturnRequestSchema.parse(request.body);
    if (!(await canHandle(request, request.params.id))) return reply.forbidden("Access denied");

    const { rr, outcome } = await app.prisma.$transaction((tx) => resolveReturn(tx, request.params.id, body, user.sub));
    notifyReturnUpdate(app.fcm, app.prisma, rr, rr.status === "REJECTED" ? { kind: "REJECTED" } : { kind: "APPROVED", refunded: outcome.refunded });
    return { success: true, data: rr } satisfies ApiResponse<typeof rr>;
  });

  // ── PATCH /:id/receive — Staff record an item dropped at the store ─────────
  app.patch<{ Params: { id: string } }>("/:id/receive", { preHandler: [authenticate, requirePermission(Permission.RETURNS_HANDLE)] }, async (request, reply) => {
    const user = getOrgUser(request);
    if (!(await canHandle(request, request.params.id))) return reply.forbidden("Access denied");

    const result = await app.prisma.$transaction(async (tx) => {
      const rr = await loadReturn(tx, request.params.id);
      if (!rr) throw Object.assign(new Error("Return request not found"), { statusCode: 404 });
      const outcome = await receiveReturn(tx, rr, { userId: user.sub });
      return { rr: (await loadReturn(tx, rr.id))!, outcome };
    });
    notifyReturnUpdate(app.fcm, app.prisma, result.rr, { kind: "RECEIVED", refunded: result.outcome.refunded });
    return { success: true, data: result.rr } satisfies ApiResponse<typeof result.rr>;
  });

  // ── POST /:id/collect — Rider collects the item while delivering the customer's next order ─────────
  app.post<{ Params: { id: string } }>("/:id/collect", { preHandler: [authenticate, requirePermission(Permission.DELIVERY_DELIVER, Permission.RETURNS_HANDLE)] }, async (request, reply) => {
    const user = getOrgUser(request);
    const { orderId } = collectReturnSchema.parse(request.body);
    const pending = await app.prisma.returnRequest.findUnique({ where: { id: request.params.id }, select: { userId: true, storeId: true } });
    if (!pending) return reply.notFound("Return request not found");
    const denial = await collectDenial(app.prisma, user, pending, orderId);
    if (denial) return reply.forbidden(denial);

    const result = await app.prisma.$transaction(async (tx) => {
      const rr = (await loadReturn(tx, request.params.id))!;
      const outcome = await receiveReturn(tx, rr, { userId: user.sub, orderId });
      return { rr: (await loadReturn(tx, rr.id))!, outcome };
    });
    notifyReturnUpdate(app.fcm, app.prisma, result.rr, { kind: "RECEIVED", refunded: result.outcome.refunded });
    return { success: true, data: result.rr } satisfies ApiResponse<typeof result.rr>;
  });

  // ── PATCH /my-requests/:id/method — Customer switches between rider collection and store drop ──
  app.patch<{ Params: { id: string } }>("/my-requests/:id/method", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const { method } = chooseReturnMethodSchema.parse(request.body);
    const updated = await app.prisma.returnRequest.updateMany({
      where: { id: request.params.id, userId: user.sub, status: "IN_PROGRESS", receivedAt: null, method: { in: ["NEXT_ORDER", "AT_STORE"] } },
      data: { method },
    });
    if (updated.count === 0) return reply.badRequest("This return isn't waiting for an item");
    const rr = await app.prisma.returnRequest.findUniqueOrThrow({ where: { id: request.params.id } });
    return { success: true, data: rr } satisfies ApiResponse<typeof rr>;
  });

  /** Staff may act on a return only within their own stores */
  async function canHandle(request: FastifyRequest, id: string): Promise<boolean> {
    const rr = await app.prisma.returnRequest.findUnique({ where: { id }, select: { storeId: true } });
    if (!rr) throw Object.assign(new Error("Return request not found"), { statusCode: 404 });
    const storeIds = await getOrgStoreIds(request, app.prisma);
    return !storeIds || storeIds.includes(rr.storeId);
  }
}
