import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createOrderSchema, updateOrderStatusSchema, verifyPaymentSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { sendOrderStatusNotification } from "../../services/notification.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { reserveStock, releaseStock, deductStock } from "../../services/stock.js";
import { formatVariantUnit } from "../../services/units.js";
import { createRazorpayOrder, verifyRazorpaySignature, isRazorpayConfigured, getRazorpayKeyId } from "../../services/payment.js";

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

function formatOrderUnits<T extends { items?: { variant?: { unitType: string } }[] }>(order: T): T {
  if (!order.items) return order;
  return {
    ...order,
    items: order.items.map((item) =>
      item.variant ? { ...item, variant: formatVariantUnit(item.variant) } : item,
    ),
  };
}

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
      data: orders.map(formatOrderUnits),
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

    const response: ApiResponse<typeof order> = { success: true, data: formatOrderUnits(order) };
    return response;
  });

  // Create order (authenticated) — reserve stock + create order in one transaction
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const user = request.user as { sub: string };

    // Resolve delivery address from addressId or direct input
    let deliveryAddress = body.deliveryAddress ?? "";
    if (body.addressId) {
      const addr = await app.prisma.userAddress.findUnique({ where: { id: body.addressId } });
      if (!addr || addr.userId !== user.sub) {
        return reply.notFound("Address not found");
      }
      deliveryAddress = addr.address;
    }

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

    // Reserve stock + create order in a single transaction
    try {
      const order = await app.prisma.$transaction(async (tx) => {
        // Reserve stock atomically
        for (const item of stockItems) {
          const result = await tx.$executeRaw`
            UPDATE store_products
            SET reserved_stock = reserved_stock + ${item.quantity}
            WHERE id = ${item.storeProductId}
              AND stock - reserved_stock >= ${item.quantity}
          `;
          if (result === 0) {
            const sp = await tx.storeProduct.findUnique({
              where: { id: item.storeProductId },
              include: { product: true },
            });
            const name = sp?.product?.name ?? item.storeProductId;
            const available = sp ? sp.stock - sp.reservedStock : 0;
            throw Object.assign(
              new Error(`Insufficient stock for "${name}" (available: ${available}, requested: ${item.quantity})`),
              { statusCode: 409 },
            );
          }
        }

        // Create order in the same transaction
        return tx.order.create({
          data: {
            userId: user.sub,
            storeId: body.storeId,
            deliveryAddress,
            paymentMethod: body.paymentMethod as "ONLINE" | "COD",
            totalAmount,
            status: "PENDING",
            paymentStatus: body.paymentMethod === "COD" ? "PENDING" : "PENDING",
            items: { create: itemsData },
          },
          include: { items: { include: { variant: true } } },
        });
      });

      const response: ApiResponse<typeof order> = { success: true, data: formatOrderUnits(order) };
      return response;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      if (e.statusCode === 409) {
        return reply.status(409).send({
          success: false,
          error: "Insufficient Stock",
          message: e.message,
          statusCode: 409,
        });
      }
      throw err;
    }
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

      // Prevent no-op transitions
      if (existing.status === body.status) {
        return reply.status(400).send({
          success: false,
          error: "Invalid Transition",
          message: `Order is already ${body.status}`,
          statusCode: 400,
        });
      }

      // Validate status transition
      const allowed = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(body.status)) {
        return reply.status(400).send({
          success: false,
          error: "Invalid Transition",
          message: `Cannot transition from ${existing.status} to ${body.status}`,
          statusCode: 400,
        });
      }

      const stockItems = existing.items.map((i) => ({
        storeProductId: i.storeProductId,
        quantity: i.quantity,
      }));

      // Perform stock operation + status update together
      if (body.status === "DELIVERED") {
        await deductStock(app.prisma, stockItems);
      } else if (body.status === "CANCELLED") {
        await releaseStock(app.prisma, stockItems);
      }

      const order = await app.prisma.order.update({
        where: { id: request.params.id },
        data: { status: body.status },
        include: { items: true },
      });

      sendOrderStatusNotification(app.fcm, app.prisma, order.id, existing.userId, body.status);

      const response: ApiResponse<typeof order> = { success: true, data: order };
      return response;
    },
  );

  // Create Razorpay payment order
  app.post<{ Params: { id: string } }>(
    "/:id/payment",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!isRazorpayConfigured()) {
        return reply.status(503).send({
          success: false,
          error: "Payment Gateway Unavailable",
          message: "Online payments are not configured",
          statusCode: 503,
        });
      }

      const order = await app.prisma.order.findUnique({ where: { id: request.params.id } });
      if (!order) return reply.notFound("Order not found");

      const user = request.user as { sub: string };
      if (order.userId !== user.sub) return reply.forbidden("Access denied");

      if (order.paymentStatus === "PAID") {
        return reply.badRequest("Order is already paid");
      }

      const amountInPaise = Math.round(Number(order.totalAmount) * 100);
      const rpOrder = await createRazorpayOrder(amountInPaise, order.id);

      await app.prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: rpOrder.id },
      });

      const response: ApiResponse<{
        razorpay_order_id: string;
        amount: number;
        currency: string;
        key_id: string;
      }> = {
        success: true,
        data: {
          razorpay_order_id: rpOrder.id,
          amount: amountInPaise,
          currency: "INR",
          key_id: getRazorpayKeyId(),
        },
      };
      return response;
    },
  );

  // Verify Razorpay payment
  app.post<{ Params: { id: string } }>(
    "/:id/payment/verify",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = verifyPaymentSchema.parse(request.body);

      const order = await app.prisma.order.findUnique({ where: { id: request.params.id } });
      if (!order) return reply.notFound("Order not found");

      const user = request.user as { sub: string };
      if (order.userId !== user.sub) return reply.forbidden("Access denied");

      const isValid = verifyRazorpaySignature(
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature,
      );

      if (isValid) {
        const updated = await app.prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "PAID",
            razorpayPaymentId: body.razorpay_payment_id,
          },
        });

        const response: ApiResponse<typeof updated> = { success: true, data: updated };
        return response;
      } else {
        await app.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "FAILED" },
        });

        return reply.badRequest("Payment verification failed");
      }
    },
  );
}
