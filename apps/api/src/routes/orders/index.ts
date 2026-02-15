import type { FastifyInstance } from "fastify";
import { createOrderSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

export async function orderRoutes(app: FastifyInstance) {
  // List orders (authenticated)
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
    const skip = (page - 1) * pageSize;
    const user = request.user as { sub: string; role: string };

    const where = user.role === "CUSTOMER" ? { userId: user.sub } : {};

    const [orders, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { items: true },
      }),
      app.prisma.order.count({ where }),
    ]);

    const response: PaginatedResponse<typeof orders[0]> = {
      success: true,
      data: orders,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
    return response;
  });

  // Get order by ID (authenticated)
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const order = await app.prisma.order.findUnique({
      where: { id: request.params.id },
      include: { items: true },
    });
    if (!order) return reply.notFound("Order not found");

    const response: ApiResponse<typeof order> = { success: true, data: order };
    return response;
  });

  // Create order (authenticated)
  app.post("/", { preHandler: [authenticate] }, async (request) => {
    const body = createOrderSchema.parse(request.body);
    const user = request.user as { sub: string };

    // Calculate totals from store products
    const storeProducts = await app.prisma.storeProduct.findMany({
      where: { id: { in: body.items.map((i) => i.storeProductId) } },
    });

    const priceMap = new Map(storeProducts.map((sp) => [sp.id, sp.price.toNumber()]));
    let totalAmount = 0;

    const itemsData = body.items.map((item) => {
      const unitPrice = priceMap.get(item.storeProductId) ?? 0;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;
      return {
        storeProductId: item.storeProductId,
        productId: storeProducts.find((sp) => sp.id === item.storeProductId)!.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      };
    });

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
      include: { items: true },
    });

    const response: ApiResponse<typeof order> = { success: true, data: order };
    return response;
  });
}
