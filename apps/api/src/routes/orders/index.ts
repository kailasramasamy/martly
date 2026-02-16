import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createOrderSchema, updateOrderStatusSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { sendOrderStatusNotification } from "../../services/notification.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { reserveStock, releaseStock, deductStock } from "../../services/stock.js";

export async function orderRoutes(app: FastifyInstance) {
  // List orders (scoped by role + org)
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};

    if (user.role === "CUSTOMER") {
      where.userId = user.sub;
    } else if (user.role !== "SUPER_ADMIN") {
      // Org-scoped: filter by org's stores
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      if (orgStoreIds !== undefined) {
        where.storeId = { in: orgStoreIds };
      }
    }

    const [orders, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true, variant: true } } },
      }),
      app.prisma.order.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof orders)[0]> = {
      success: true,
      data: orders,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // Get order by ID (verify org access)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const order = await app.prisma.order.findUnique({
      where: { id: request.params.id },
      include: { items: { include: { product: true, variant: true } } },
    });
    if (!order) return reply.notFound("Order not found");

    const user = getOrgUser(request);
    if (user.role === "CUSTOMER") {
      if (order.userId !== user.sub) return reply.forbidden("Access denied");
    } else if (user.role !== "SUPER_ADMIN") {
      if (!(await verifyStoreOrgAccess(request, app.prisma, order.storeId))) {
        return reply.forbidden("Access denied");
      }
    }

    const response: ApiResponse<typeof order> = { success: true, data: order };
    return response;
  });

  // Create order (authenticated)
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const user = request.user as { sub: string };

    const storeProducts = await app.prisma.storeProduct.findMany({
      where: { id: { in: body.items.map((i) => i.storeProductId) } },
      include: { variant: true },
    });

    let totalAmount = 0;

    const itemsData = body.items.map((item) => {
      const sp = storeProducts.find((sp) => sp.id === item.storeProductId)!;
      const pricing = calculateEffectivePrice(
        sp.price as unknown as number,
        sp.variant as Parameters<typeof calculateEffectivePrice>[1],
        sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      );
      const unitPrice = pricing.effectivePrice;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;
      return {
        storeProductId: item.storeProductId,
        productId: sp.productId,
        variantId: sp.variantId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        originalPrice: pricing.discountActive ? pricing.originalPrice : undefined,
        discountType: pricing.discountType ?? undefined,
        discountValue: pricing.discountValue ?? undefined,
      } as Prisma.OrderItemUncheckedCreateWithoutOrderInput;
    });

    const stockItems = body.items.map((item) => ({
      storeProductId: item.storeProductId,
      quantity: item.quantity,
    }));

    try {
      await reserveStock(app.prisma, stockItems);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 409).send({
        success: false,
        error: "Insufficient Stock",
        message: e.message,
        statusCode: e.statusCode ?? 409,
      });
    }

    const order = await app.prisma.order.create({
      data: {
        userId: user.sub,
        storeId: body.storeId,
        deliveryAddress: body.deliveryAddress,
        totalAmount,
        status: "PENDING",
        paymentStatus: "PENDING",
        items: { create: itemsData },
      },
      include: { items: { include: { variant: true } } },
    });

    const response: ApiResponse<typeof order> = { success: true, data: order };
    return response;
  });

  // Update order status (verify org access)
  app.patch<{ Params: { id: string } }>(
    "/:id/status",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER", "STAFF")] },
    async (request, reply) => {
      const body = updateOrderStatusSchema.parse(request.body);
      const existing = await app.prisma.order.findUnique({
        where: { id: request.params.id },
        include: { items: true },
      });
      if (!existing) return reply.notFound("Order not found");

      // Verify org access for non-SUPER_ADMIN
      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
        return reply.forbidden("Access denied");
      }

      const order = await app.prisma.order.update({
        where: { id: request.params.id },
        data: { status: body.status },
        include: { items: true },
      });

      const stockItems = existing.items.map((i) => ({
        storeProductId: i.storeProductId,
        quantity: i.quantity,
      }));

      if (body.status === "DELIVERED") {
        await deductStock(app.prisma, stockItems);
      } else if (body.status === "CANCELLED") {
        await releaseStock(app.prisma, stockItems);
      }

      sendOrderStatusNotification(app.fcm, app.prisma, order.id, existing.userId, body.status);

      const response: ApiResponse<typeof order> = { success: true, data: order };
      return response;
    },
  );
}
