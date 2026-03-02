import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createOrderSchema, updateOrderStatusSchema, updatePaymentStatusSchema, verifyPaymentSchema, bulkUpdateOrderStatusSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { haversine } from "../../lib/geo.js";
import { sendOrderStatusNotification, sendWalletNotification, sendLoyaltyNotification, sendNotification } from "../../services/notification.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { reserveStock, releaseStock, deductStock } from "../../services/stock.js";
import { formatVariantUnit } from "../../services/units.js";
import { createRazorpayOrder, verifyRazorpaySignature, isRazorpayConfigured, getRazorpayKeyId } from "../../services/payment.js";
import { broadcastOrderUpdate } from "../../services/order-broadcast.js";

// Valid status transitions
const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const PICKUP_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],  // Skip OUT_FOR_DELIVERY for pickup
  DELIVERED: [],
  CANCELLED: [],
};

function getValidTransitions(fulfillmentType: string): Record<string, string[]> {
  return fulfillmentType === "PICKUP" ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS;
}

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
    const {
      page = 1, pageSize = 20, userId, status, paymentStatus, paymentMethod, fulfillmentType, q,
      dateFrom, dateTo, sortBy, sortOrder,
    } = request.query as {
      page?: number; pageSize?: number; userId?: string; status?: string;
      paymentStatus?: string; paymentMethod?: string; fulfillmentType?: string; q?: string;
      dateFrom?: string; dateTo?: string; sortBy?: string; sortOrder?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);

    const where: Record<string, unknown> = {};

    if (user.role === "CUSTOMER") {
      where.userId = user.sub;
    } else if (userId) {
      where.userId = userId;
    } else if (user.role !== "SUPER_ADMIN") {
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      if (orgStoreIds !== undefined) {
        where.storeId = { in: orgStoreIds };
      }
    }

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (fulfillmentType) where.fulfillmentType = fulfillmentType;

    // Search by order ID prefix or customer email
    if (q) {
      where.OR = [
        { id: { startsWith: q } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    // Sort
    let orderBy: Record<string, string> = { createdAt: "desc" };
    if (sortBy) {
      orderBy = { [sortBy]: sortOrder === "asc" ? "asc" : "desc" };
    }

    const [orders, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy,
        include: {
          items: { include: { product: true, variant: true } },
          user: { select: { id: true, name: true, email: true } },
        },
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
      include: {
        items: { include: { product: true, variant: true } },
        statusLogs: { orderBy: { createdAt: "asc" } },
        returnRequest: { select: { id: true, status: true, requestedAmount: true, approvedAmount: true } },
      },
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
    const fulfillmentType = body.fulfillmentType ?? "DELIVERY";
    const isPickup = fulfillmentType === "PICKUP";

    // Fetch store for both pickup and delivery
    const store = await app.prisma.store.findUnique({
      where: { id: body.storeId },
      select: { name: true, address: true, latitude: true, longitude: true, deliveryRadius: true, minOrderAmount: true, freeDeliveryThreshold: true, baseDeliveryFee: true },
    });

    // Resolve delivery address from addressId or direct input
    let deliveryAddress: string | null = null;
    let deliveryPincode: string | null = null;
    if (isPickup) {
      // For pickup, store the store address for the record
      deliveryAddress = store?.address ?? null;
    } else {
      deliveryAddress = body.deliveryAddress ?? null;
      if (body.addressId) {
        const addr = await app.prisma.userAddress.findUnique({ where: { id: body.addressId } });
        if (!addr || addr.userId !== user.sub) {
          return reply.notFound("Address not found");
        }
        deliveryAddress = addr.address;
        deliveryPincode = addr.pincode ?? null;
      }
    }

    const storeProducts = await app.prisma.storeProduct.findMany({
      where: { id: { in: body.items.map((i) => i.storeProductId) } },
      include: { variant: true },
    });

    let itemsTotal = 0;

    const itemsData = body.items.map((item) => {
      const sp = storeProducts.find((sp) => sp.id === item.storeProductId)!;
      const pricing = calculateEffectivePrice(
        sp.price as unknown as number,
        sp.variant as Parameters<typeof calculateEffectivePrice>[1],
        sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      );
      const unitPrice = pricing.effectivePrice;
      const totalPrice = unitPrice * item.quantity;
      itemsTotal += totalPrice;
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

    // Minimum order amount validation
    if (store?.minOrderAmount && itemsTotal < Number(store.minOrderAmount)) {
      return reply.status(400).send({
        success: false,
        error: "Minimum Order Not Met",
        message: `Minimum order amount is \u20B9${Number(store.minOrderAmount).toFixed(0)}. Your cart total is \u20B9${itemsTotal.toFixed(0)}.`,
        statusCode: 400,
      });
    }

    // Coupon validation
    let couponId: string | undefined;
    let couponCode: string | undefined;
    let couponDiscount = 0;
    let couponRecord: { id: string; code: string; discountType: string; discountValue: any; maxDiscount: any; usageLimit: number | null; usedCount: number; perUserLimit: number; minOrderAmount: any; startsAt: Date | null; expiresAt: Date | null; isActive: boolean; organizationId: string | null } | null = null;

    if (body.couponCode) {
      couponRecord = await app.prisma.coupon.findUnique({ where: { code: body.couponCode.toUpperCase() } });
      if (couponRecord && couponRecord.isActive) {
        const now = new Date();
        const valid = (!couponRecord.startsAt || now >= couponRecord.startsAt)
          && (!couponRecord.expiresAt || now <= couponRecord.expiresAt)
          && (!couponRecord.usageLimit || couponRecord.usedCount < couponRecord.usageLimit)
          && (!couponRecord.minOrderAmount || itemsTotal >= Number(couponRecord.minOrderAmount));

        if (valid) {
          const userRedemptions = await app.prisma.couponRedemption.count({
            where: { couponId: couponRecord.id, userId: user.sub },
          });
          if (userRedemptions < couponRecord.perUserLimit) {
            couponId = couponRecord.id;
            couponCode = couponRecord.code;
            if (couponRecord.discountType === "FLAT") {
              couponDiscount = Number(couponRecord.discountValue);
            } else {
              couponDiscount = (itemsTotal * Number(couponRecord.discountValue)) / 100;
            }
            if (couponRecord.maxDiscount && couponDiscount > Number(couponRecord.maxDiscount)) {
              couponDiscount = Number(couponRecord.maxDiscount);
            }
            couponDiscount = Math.min(couponDiscount, itemsTotal);
          }
        }
      }
    }

    // Delivery fee lookup — skip for pickup orders
    let deliveryFee = 0;
    let deliveryDistance: number | undefined;
    let estimatedMinutes: number | undefined;

    if (isPickup) {
      // Pickup: no delivery fee, estimated 30 min prep time
      deliveryFee = 0;
      estimatedMinutes = 30;
    } else {
      // Resolve lat/lng from body or from addressId
      let deliveryLat = body.deliveryAddressLat;
      let deliveryLng = body.deliveryAddressLng;
      if (deliveryLat == null || deliveryLng == null) {
        if (body.addressId) {
          const addr = await app.prisma.userAddress.findUnique({ where: { id: body.addressId } });
          if (addr?.latitude != null && addr?.longitude != null) {
            deliveryLat = addr.latitude;
            deliveryLng = addr.longitude;
          }
        }
      }

      // Try distance-based delivery tier lookup
      let usedDistanceTier = false;
      if (store?.latitude != null && store?.longitude != null && deliveryLat != null && deliveryLng != null) {
        const dist = haversine(deliveryLat, deliveryLng, store.latitude, store.longitude);
        deliveryDistance = dist;

        if (dist > store.deliveryRadius) {
          return reply.status(400).send({
            success: false,
            error: "Not Serviceable",
            message: `Delivery address is ${dist.toFixed(1)} km away, which exceeds the store's delivery radius of ${store.deliveryRadius} km`,
            statusCode: 400,
          });
        }

        const tier = await app.prisma.deliveryTier.findFirst({
          where: {
            storeId: body.storeId,
            isActive: true,
            minDistance: { lte: dist },
            maxDistance: { gt: dist },
          },
        });

        if (tier) {
          deliveryFee = Number(tier.deliveryFee);
          estimatedMinutes = tier.estimatedMinutes;
          usedDistanceTier = true;
        }
      }

      // Fallback to zone-based delivery fee if no distance tier matched
      if (!usedDistanceTier) {
        const storeZones = await app.prisma.storeDeliveryZone.findMany({
          where: { storeId: body.storeId },
          include: { deliveryZone: true },
        });
        const activeZone = storeZones.find((sz) => sz.deliveryZone.isActive)?.deliveryZone;
        if (activeZone) {
          deliveryFee = Number(activeZone.deliveryFee);
          estimatedMinutes = activeZone.estimatedMinutes;
        }
      }

      // Store-level base delivery fee as final fallback
      if (deliveryFee === 0 && store?.baseDeliveryFee) {
        deliveryFee = Number(store.baseDeliveryFee);
      }
    }

    // Free delivery threshold override
    if (!isPickup && store?.freeDeliveryThreshold && itemsTotal >= Number(store.freeDeliveryThreshold)) {
      deliveryFee = 0;
    }

    // Express delivery validation (orders without a delivery slot)
    if (!body.deliverySlotId && !isPickup) {
      const expressConfig = await app.prisma.expressDeliveryConfig.findUnique({
        where: { storeId: body.storeId },
      });

      if (expressConfig) {
        if (!expressConfig.isEnabled) {
          return reply.status(400).send({
            success: false,
            error: "Express Unavailable",
            message: "Express delivery is not available for this store",
            statusCode: 400,
          });
        }

        if (expressConfig.operatingStart && expressConfig.operatingEnd) {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const [startH, startM] = expressConfig.operatingStart.split(":").map(Number);
          const [endH, endM] = expressConfig.operatingEnd.split(":").map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;

          if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
            return reply.status(400).send({
              success: false,
              error: "Express Unavailable",
              message: "Express delivery is outside operating hours",
              statusCode: 400,
            });
          }
        }

        // Override ETA with config value
        if (expressConfig.etaMinutes != null) {
          estimatedMinutes = expressConfig.etaMinutes;
        }
      }
    }

    // Delivery slot validation
    let deliverySlotId: string | undefined;
    let scheduledDate: Date | undefined;
    let slotStartTime: string | undefined;
    let slotEndTime: string | undefined;

    if (body.deliverySlotId && body.scheduledDate) {
      const slot = await app.prisma.deliverySlot.findUnique({
        where: { id: body.deliverySlotId },
      });

      if (!slot) return reply.badRequest("Delivery slot not found");
      if (!slot.isActive) return reply.badRequest("Delivery slot is not active");
      if (slot.storeId !== body.storeId) return reply.badRequest("Delivery slot does not belong to this store");

      const parsedDate = new Date(body.scheduledDate + "T00:00:00");
      if (isNaN(parsedDate.getTime())) return reply.badRequest("Invalid scheduledDate format");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 7);
      if (parsedDate < today || parsedDate > maxDate) {
        return reply.badRequest("Scheduled date must be within 7 days");
      }

      if (parsedDate.getDay() !== slot.dayOfWeek) {
        return reply.badRequest("Scheduled date does not match slot day of week");
      }

      // Check cutoff for today
      const isToday = parsedDate.toDateString() === new Date().toDateString();
      if (isToday) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [h, m] = slot.startTime.split(":").map(Number);
        if (currentMinutes >= h * 60 + m - slot.cutoffMinutes) {
          return reply.badRequest("This slot is past its booking cutoff time");
        }
      }

      // Check capacity
      const startOfDay = new Date(body.scheduledDate + "T00:00:00");
      const endOfDay = new Date(body.scheduledDate + "T23:59:59.999");
      const bookedCount = await app.prisma.order.count({
        where: {
          deliverySlotId: body.deliverySlotId,
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: { not: "CANCELLED" },
        },
      });
      if (bookedCount >= slot.maxOrders) {
        return reply.badRequest("This delivery slot is full");
      }

      deliverySlotId = slot.id;
      scheduledDate = parsedDate;
      slotStartTime = slot.startTime;
      slotEndTime = slot.endTime;

      // Override estimatedDeliveryAt with scheduled time
      const [sh, sm] = slot.startTime.split(":").map(Number);
      estimatedMinutes = undefined; // will set estimatedDeliveryAt directly
    }

    const totalAmount = itemsTotal - couponDiscount + deliveryFee;

    const stockItems = body.items.map((item) => ({
      storeProductId: item.storeProductId,
      quantity: item.quantity,
    }));

    // Reserve stock + create order in a single transaction
    try {
      const result = await app.prisma.$transaction(async (tx) => {
        // Reserve stock atomically
        for (const item of stockItems) {
          const res = await tx.$executeRaw`
            UPDATE store_products
            SET reserved_stock = reserved_stock + ${item.quantity}
            WHERE id = ${item.storeProductId}
              AND stock - reserved_stock >= ${item.quantity}
          `;
          if (res === 0) {
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

        // Wallet deduction
        let walletDeduction = 0;
        if (body.useWallet !== false) {
          const userData = await tx.user.findUnique({
            where: { id: user.sub },
            select: { walletBalance: true },
          });
          const walletBalance = Number(userData?.walletBalance ?? 0);
          walletDeduction = Math.min(walletBalance, totalAmount);
        }

        let remainingAfterWallet = totalAmount - walletDeduction;

        // Loyalty points redemption
        let loyaltyDeduction = 0;
        if (body.useLoyaltyPoints && remainingAfterWallet > 0) {
          const storeForOrg = await tx.store.findUnique({
            where: { id: body.storeId },
            select: { organizationId: true },
          });
          if (storeForOrg) {
            const loyaltyConfig = await tx.loyaltyConfig.findUnique({
              where: { organizationId: storeForOrg.organizationId },
            });
            if (loyaltyConfig?.isEnabled) {
              const loyaltyBalance = await tx.loyaltyBalance.findUnique({
                where: {
                  userId_organizationId: {
                    userId: user.sub,
                    organizationId: storeForOrg.organizationId,
                  },
                },
              });
              if (loyaltyBalance && loyaltyBalance.points >= loyaltyConfig.minRedeemPoints) {
                const maxByPercentage = Math.floor(totalAmount * loyaltyConfig.maxRedeemPercentage / 100);
                loyaltyDeduction = Math.min(
                  loyaltyBalance.points,
                  remainingAfterWallet,
                  maxByPercentage,
                );
                if (loyaltyDeduction > 0) {
                  remainingAfterWallet -= loyaltyDeduction;
                }
              }
            }
          }
        }

        const remainingAmount = remainingAfterWallet;
        const walletFullyCovered = remainingAmount === 0 && (walletDeduction > 0 || loyaltyDeduction > 0);

        // Determine initial payment status
        let paymentStatus: "PENDING" | "PAID" = "PENDING";
        let orderStatus: "PENDING" | "CONFIRMED" = "PENDING";
        if (walletFullyCovered) {
          paymentStatus = "PAID";
          orderStatus = "CONFIRMED";
        }

        // Create order in the same transaction
        const newOrder = await tx.order.create({
          data: {
            userId: user.sub,
            storeId: body.storeId,
            fulfillmentType,
            deliveryAddress,
            deliveryPincode: deliveryPincode ?? undefined,
            paymentMethod: body.paymentMethod as "ONLINE" | "COD",
            totalAmount,
            status: orderStatus,
            paymentStatus,
            couponId,
            couponCode,
            couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
            deliveryFee,
            deliveryDistance,
            deliveryNotes: body.deliveryNotes,
            walletAmountUsed: walletDeduction > 0 ? walletDeduction : undefined,
            loyaltyPointsUsed: loyaltyDeduction > 0 ? loyaltyDeduction : undefined,
            estimatedDeliveryAt: scheduledDate && slotStartTime
              ? (() => {
                  const [sh, sm] = slotStartTime.split(":").map(Number);
                  const dt = new Date(scheduledDate);
                  dt.setHours(sh, sm, 0, 0);
                  return dt;
                })()
              : estimatedMinutes ? new Date(Date.now() + estimatedMinutes * 60000) : undefined,
            deliverySlotId: deliverySlotId ?? undefined,
            scheduledDate: scheduledDate ?? undefined,
            slotStartTime: slotStartTime ?? undefined,
            slotEndTime: slotEndTime ?? undefined,
            items: { create: itemsData },
            statusLogs: {
              create: walletFullyCovered
                ? [
                    { status: "PENDING" },
                    { status: "CONFIRMED", note: "Fully paid via wallet" },
                  ]
                : { status: "PENDING" },
            },
          },
          include: { items: { include: { variant: true } } },
        });

        // Deduct wallet balance
        if (walletDeduction > 0) {
          const updatedUser = await tx.user.update({
            where: { id: user.sub },
            data: { walletBalance: { decrement: walletDeduction } },
          });
          await tx.walletTransaction.create({
            data: {
              userId: user.sub,
              orderId: newOrder.id,
              type: "DEBIT",
              amount: walletDeduction,
              balanceAfter: Number(updatedUser.walletBalance),
              description: `Used for order #${newOrder.id.slice(0, 8)}`,
            },
          });
        }

        // Loyalty points deduction
        if (loyaltyDeduction > 0) {
          const storeForOrg = await tx.store.findUnique({
            where: { id: body.storeId },
            select: { organizationId: true },
          });
          if (storeForOrg) {
            const updatedBalance = await tx.loyaltyBalance.update({
              where: {
                userId_organizationId: {
                  userId: user.sub,
                  organizationId: storeForOrg.organizationId,
                },
              },
              data: {
                points: { decrement: loyaltyDeduction },
                totalRedeemed: { increment: loyaltyDeduction },
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                userId: user.sub,
                organizationId: storeForOrg.organizationId,
                orderId: newOrder.id,
                type: "REDEEM",
                points: -loyaltyDeduction,
                balanceAfter: updatedBalance.points,
                description: `Redeemed for order #${newOrder.id.slice(0, 8)}`,
              },
            });
          }
        }

        // Create coupon redemption + increment usedCount
        if (couponId && couponRecord) {
          await tx.couponRedemption.create({
            data: { couponId, userId: user.sub, orderId: newOrder.id },
          });
          await tx.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          });
        }

        return { order: newOrder, walletFullyCovered, walletDeduction, loyaltyDeduction, remainingAmount };
      });

      const responseData = {
        ...formatOrderUnits(result.order),
        walletFullyCovered: result.walletFullyCovered,
        walletAmountUsed: result.walletDeduction,
        loyaltyPointsUsed: result.loyaltyDeduction,
        razorpayAmount: Math.round(result.remainingAmount * 100),
      };
      const response: ApiResponse<typeof responseData> = { success: true, data: responseData };
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

      // Validate status transition (pickup-aware)
      const transitions = getValidTransitions(existing.fulfillmentType);
      const allowed = transitions[existing.status] ?? [];
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

      const txResult = await app.prisma.$transaction(async (tx) => {
        const updateData: Record<string, unknown> = { status: body.status };

        // Auto-mark COD as PAID on delivery
        if (body.status === "DELIVERED" && existing.paymentMethod === "COD" && existing.paymentStatus === "PENDING") {
          updateData.paymentStatus = "PAID";
        }

        // Loyalty points earning on DELIVERED
        if (body.status === "DELIVERED") {
          const orderStore = await tx.store.findUnique({
            where: { id: existing.storeId },
            select: { organizationId: true },
          });
          if (orderStore) {
            const loyaltyConfig = await tx.loyaltyConfig.findUnique({
              where: { organizationId: orderStore.organizationId },
            });
            if (loyaltyConfig?.isEnabled && loyaltyConfig.earnRate > 0) {
              const pointsEarned = Math.floor(Number(existing.totalAmount) / 100 * loyaltyConfig.earnRate);
              if (pointsEarned > 0) {
                updateData.loyaltyPointsEarned = pointsEarned;
                const balance = await tx.loyaltyBalance.upsert({
                  where: {
                    userId_organizationId: {
                      userId: existing.userId,
                      organizationId: orderStore.organizationId,
                    },
                  },
                  create: {
                    userId: existing.userId,
                    organizationId: orderStore.organizationId,
                    points: pointsEarned,
                    totalEarned: pointsEarned,
                  },
                  update: {
                    points: { increment: pointsEarned },
                    totalEarned: { increment: pointsEarned },
                  },
                });
                await tx.loyaltyTransaction.create({
                  data: {
                    userId: existing.userId,
                    organizationId: orderStore.organizationId,
                    orderId: existing.id,
                    type: "EARN",
                    points: pointsEarned,
                    balanceAfter: balance.points,
                    description: `Earned from order #${existing.id.slice(0, 8)}`,
                  },
                });
              }
            }
          }
        }

        // Referral reward on first DELIVERED order
        let referralCompleted = false;
        let referralReferrerId: string | null = null;
        let referralReferrerReward = 0;
        let referralRefereeReward = 0;
        if (body.status === "DELIVERED") {
          const orderStore = await tx.store.findUnique({
            where: { id: existing.storeId },
            select: { organizationId: true },
          });
          if (orderStore) {
            // Check if this is the user's first delivered order in this org
            const prevDelivered = await tx.order.count({
              where: {
                userId: existing.userId,
                store: { organizationId: orderStore.organizationId },
                status: "DELIVERED",
                id: { not: existing.id },
              },
            });
            if (prevDelivered === 0) {
              // First delivery — check for pending referral
              const pendingReferral = await tx.referral.findUnique({
                where: {
                  refereeId_organizationId: {
                    refereeId: existing.userId,
                    organizationId: orderStore.organizationId,
                  },
                  status: "PENDING",
                },
              });
              if (pendingReferral) {
                const rrReward = Number(pendingReferral.referrerReward);
                const reReward = Number(pendingReferral.refereeReward);

                // Credit referrer wallet
                if (rrReward > 0) {
                  const updatedReferrer = await tx.user.update({
                    where: { id: pendingReferral.referrerId },
                    data: { walletBalance: { increment: rrReward } },
                  });
                  await tx.walletTransaction.create({
                    data: {
                      userId: pendingReferral.referrerId,
                      type: "CREDIT",
                      amount: rrReward,
                      balanceAfter: Number(updatedReferrer.walletBalance),
                      description: `Referral reward — your friend placed their first order`,
                    },
                  });
                }

                // Credit referee wallet
                if (reReward > 0) {
                  const updatedReferee = await tx.user.update({
                    where: { id: existing.userId },
                    data: { walletBalance: { increment: reReward } },
                  });
                  await tx.walletTransaction.create({
                    data: {
                      userId: existing.userId,
                      type: "CREDIT",
                      amount: reReward,
                      balanceAfter: Number(updatedReferee.walletBalance),
                      description: `Welcome reward — referral bonus for your first order`,
                    },
                  });
                }

                // Mark referral as completed
                await tx.referral.update({
                  where: { id: pendingReferral.id },
                  data: {
                    status: "COMPLETED",
                    orderId: existing.id,
                    completedAt: new Date(),
                  },
                });

                referralCompleted = true;
                referralReferrerId = pendingReferral.referrerId;
                referralReferrerReward = rrReward;
                referralRefereeReward = reReward;
              }
            }
          }
        }

        // Wallet refund on admin cancel
        let refundAmount = 0;
        if (body.status === "CANCELLED") {
          const walletUsed = Number(existing.walletAmountUsed ?? 0);
          const isOnlinePaid = existing.paymentMethod === "ONLINE" && existing.paymentStatus === "PAID";

          if (isOnlinePaid) {
            refundAmount = Number(existing.totalAmount);
            updateData.paymentStatus = "REFUNDED";
          } else if (walletUsed > 0) {
            refundAmount = walletUsed;
          }
        }

        // Loyalty reversal on CANCELLED
        if (body.status === "CANCELLED") {
          const orderStore = await tx.store.findUnique({
            where: { id: existing.storeId },
            select: { organizationId: true },
          });
          if (orderStore) {
            // Reverse redeemed points (credit back)
            const loyaltyUsed = existing.loyaltyPointsUsed ?? 0;
            if (loyaltyUsed > 0) {
              const balance = await tx.loyaltyBalance.upsert({
                where: {
                  userId_organizationId: {
                    userId: existing.userId,
                    organizationId: orderStore.organizationId,
                  },
                },
                create: {
                  userId: existing.userId,
                  organizationId: orderStore.organizationId,
                  points: loyaltyUsed,
                  totalEarned: 0,
                },
                update: {
                  points: { increment: loyaltyUsed },
                  totalRedeemed: { decrement: loyaltyUsed },
                },
              });
              await tx.loyaltyTransaction.create({
                data: {
                  userId: existing.userId,
                  organizationId: orderStore.organizationId,
                  orderId: existing.id,
                  type: "REVERSAL",
                  points: loyaltyUsed,
                  balanceAfter: balance.points,
                  description: `Reversal for cancelled order #${existing.id.slice(0, 8)}`,
                },
              });
            }

            // Reverse earned points (deduct)
            const loyaltyEarned = existing.loyaltyPointsEarned ?? 0;
            if (loyaltyEarned > 0) {
              const balance = await tx.loyaltyBalance.update({
                where: {
                  userId_organizationId: {
                    userId: existing.userId,
                    organizationId: orderStore.organizationId,
                  },
                },
                data: {
                  points: { decrement: loyaltyEarned },
                  totalEarned: { decrement: loyaltyEarned },
                },
              });
              await tx.loyaltyTransaction.create({
                data: {
                  userId: existing.userId,
                  organizationId: orderStore.organizationId,
                  orderId: existing.id,
                  type: "REVERSAL",
                  points: -loyaltyEarned,
                  balanceAfter: balance.points,
                  description: `Earned points reversed for cancelled order #${existing.id.slice(0, 8)}`,
                },
              });
            }
          }
        }

        const updated = await tx.order.update({
          where: { id: request.params.id },
          data: updateData,
          include: { items: true },
        });
        const logNote = (body.status === "DELIVERED" && existing.paymentMethod === "COD" && existing.paymentStatus === "PENDING")
          ? "COD payment collected on delivery"
          : undefined;
        await tx.orderStatusLog.create({
          data: { orderId: request.params.id, status: body.status, note: logNote },
        });

        // Refund to wallet
        if (refundAmount > 0) {
          const updatedUser = await tx.user.update({
            where: { id: existing.userId },
            data: { walletBalance: { increment: refundAmount } },
          });
          await tx.walletTransaction.create({
            data: {
              userId: existing.userId,
              orderId: existing.id,
              type: "CREDIT",
              amount: refundAmount,
              balanceAfter: Number(updatedUser.walletBalance),
              description: `Refund for cancelled order #${existing.id.slice(0, 8)}`,
            },
          });
        }

        return { updated, referralCompleted, referralReferrerId, referralReferrerReward, referralRefereeReward };
      });

      const order = txResult.updated;
      const { referralCompleted, referralReferrerId, referralReferrerReward, referralRefereeReward } = txResult;

      sendOrderStatusNotification(app.fcm, app.prisma, order.id, existing.userId, body.status);
      broadcastOrderUpdate(app.prisma, order.id, body.status);

      // Fire-and-forget: wallet refund notification on cancel
      if (body.status === "CANCELLED") {
        const walletUsed = Number(existing.walletAmountUsed ?? 0);
        const isOnlinePaid = existing.paymentMethod === "ONLINE" && existing.paymentStatus === "PAID";
        const refundAmt = isOnlinePaid ? Number(existing.totalAmount) : walletUsed;
        if (refundAmt > 0) {
          sendWalletNotification(app.fcm, app.prisma, existing.userId, "CREDIT", refundAmt, `Refund for order #${existing.id.slice(0, 8)}`);
        }
      }

      // Fire-and-forget: loyalty earned + review request on delivery
      if (body.status === "DELIVERED") {
        const pointsEarned = (order as any).loyaltyPointsEarned;
        if (pointsEarned && pointsEarned > 0) {
          sendLoyaltyNotification(app.fcm, app.prisma, existing.userId, "EARN", pointsEarned);
        }
        sendNotification(app.fcm, app.prisma, {
          userId: existing.userId,
          type: "REVIEW_REQUEST",
          title: "How was your order?",
          body: `Rate your order #${existing.id.slice(0, 8)} and help others shop better.`,
          data: { orderId: existing.id, screen: "write-review" },
        });

        // Fire-and-forget: referral wallet notifications
        if (referralCompleted) {
          if (referralReferrerId && referralReferrerReward > 0) {
            sendWalletNotification(app.fcm, app.prisma, referralReferrerId, "CREDIT", referralReferrerReward, "Referral reward");
          }
          if (referralRefereeReward > 0) {
            sendWalletNotification(app.fcm, app.prisma, existing.userId, "CREDIT", referralRefereeReward, "Referral welcome bonus");
          }
        }
      }

      // Auto-complete delivery trip when last order is delivered
      if (body.status === "DELIVERED" && existing.deliveryTripId) {
        const remaining = await app.prisma.order.count({
          where: {
            deliveryTripId: existing.deliveryTripId,
            status: { notIn: ["DELIVERED", "CANCELLED"] },
          },
        });
        if (remaining === 0) {
          await app.prisma.deliveryTrip.update({
            where: { id: existing.deliveryTripId },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
        }
      }

      const response: ApiResponse<typeof order> = { success: true, data: order };
      return response;
    },
  );

  // Update payment status (admin override)
  app.patch<{ Params: { id: string } }>(
    "/:id/payment-status",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = updatePaymentStatusSchema.parse(request.body);
      const existing = await app.prisma.order.findUnique({
        where: { id: request.params.id },
      });
      if (!existing) return reply.notFound("Order not found");

      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
        return reply.forbidden("Access denied");
      }

      if (existing.paymentStatus === "REFUNDED") {
        return reply.status(400).send({
          success: false,
          error: "Invalid Update",
          message: "Cannot change payment status of a refunded order",
          statusCode: 400,
        });
      }

      if (existing.paymentStatus === body.paymentStatus) {
        return reply.status(400).send({
          success: false,
          error: "No Change",
          message: `Payment status is already ${body.paymentStatus}`,
          statusCode: 400,
        });
      }

      const order = await app.prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: request.params.id },
          data: { paymentStatus: body.paymentStatus },
        });
        await tx.orderStatusLog.create({
          data: {
            orderId: request.params.id,
            status: existing.status,
            note: body.note || `Payment status updated to ${body.paymentStatus}`,
          },
        });
        return updated;
      });

      const response: ApiResponse<typeof order> = { success: true, data: order };
      return response;
    },
  );

  // Customer cancel their own order
  app.post<{ Params: { id: string } }>(
    "/:id/cancel",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = getOrgUser(request);
      const existing = await app.prisma.order.findUnique({
        where: { id: request.params.id },
        include: { items: true },
      });
      if (!existing) return reply.notFound("Order not found");

      // Only the order owner can cancel via this endpoint
      if (existing.userId !== user.sub) {
        return reply.forbidden("Access denied");
      }

      // Only PENDING or CONFIRMED orders can be cancelled by customer
      if (existing.status !== "PENDING" && existing.status !== "CONFIRMED") {
        return reply.status(400).send({
          success: false,
          error: "Cannot Cancel",
          message: `Order cannot be cancelled because it is already ${existing.status}`,
          statusCode: 400,
        });
      }

      const stockItems = existing.items.map((i) => ({
        storeProductId: i.storeProductId,
        quantity: i.quantity,
      }));

      await releaseStock(app.prisma, stockItems);

      const order = await app.prisma.$transaction(async (tx) => {
        // Determine refund amount
        let refundAmount = 0;
        const walletUsed = Number(existing.walletAmountUsed ?? 0);
        const isOnlinePaid = existing.paymentMethod === "ONLINE" && existing.paymentStatus === "PAID";

        if (isOnlinePaid) {
          refundAmount = Number(existing.totalAmount);
        } else if (walletUsed > 0) {
          refundAmount = walletUsed;
        }

        const updateData: Record<string, unknown> = { status: "CANCELLED" };
        if (isOnlinePaid) {
          updateData.paymentStatus = "REFUNDED";
        }

        const updated = await tx.order.update({
          where: { id: request.params.id },
          data: updateData,
          include: { items: true },
        });

        await tx.orderStatusLog.create({
          data: { orderId: request.params.id, status: "CANCELLED", note: "Cancelled by customer" },
        });

        // Refund to wallet
        if (refundAmount > 0) {
          const updatedUser = await tx.user.update({
            where: { id: existing.userId },
            data: { walletBalance: { increment: refundAmount } },
          });
          await tx.walletTransaction.create({
            data: {
              userId: existing.userId,
              orderId: existing.id,
              type: "CREDIT",
              amount: refundAmount,
              balanceAfter: Number(updatedUser.walletBalance),
              description: `Refund for cancelled order #${existing.id.slice(0, 8)}`,
            },
          });
        }

        // Loyalty reversal on customer cancel
        const loyaltyUsed = existing.loyaltyPointsUsed ?? 0;
        if (loyaltyUsed > 0) {
          const orderStore = await tx.store.findUnique({
            where: { id: existing.storeId },
            select: { organizationId: true },
          });
          if (orderStore) {
            const balance = await tx.loyaltyBalance.upsert({
              where: {
                userId_organizationId: {
                  userId: existing.userId,
                  organizationId: orderStore.organizationId,
                },
              },
              create: {
                userId: existing.userId,
                organizationId: orderStore.organizationId,
                points: loyaltyUsed,
                totalEarned: 0,
              },
              update: {
                points: { increment: loyaltyUsed },
                totalRedeemed: { decrement: loyaltyUsed },
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                userId: existing.userId,
                organizationId: orderStore.organizationId,
                orderId: existing.id,
                type: "REVERSAL",
                points: loyaltyUsed,
                balanceAfter: balance.points,
                description: `Reversal for cancelled order #${existing.id.slice(0, 8)}`,
              },
            });
          }
        }

        return updated;
      });

      sendOrderStatusNotification(app.fcm, app.prisma, order.id, existing.userId, "CANCELLED");
      broadcastOrderUpdate(app.prisma, order.id, "CANCELLED");

      // Fire-and-forget: wallet refund notification
      const walletUsed = Number(existing.walletAmountUsed ?? 0);
      const isOnlinePaid = existing.paymentMethod === "ONLINE" && existing.paymentStatus === "PAID";
      const custRefundAmt = isOnlinePaid ? Number(existing.totalAmount) : walletUsed;
      if (custRefundAmt > 0) {
        sendWalletNotification(app.fcm, app.prisma, existing.userId, "CREDIT", custRefundAmt, `Refund for order #${existing.id.slice(0, 8)}`);
      }

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

      const walletUsed = Number(order.walletAmountUsed ?? 0);
      const chargeAmount = Number(order.totalAmount) - walletUsed;
      if (chargeAmount <= 0) {
        return reply.badRequest("Order is fully covered by wallet");
      }
      const amountInPaise = Math.round(chargeAmount * 100);
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
        const updated = await app.prisma.$transaction(async (tx) => {
          const ord = await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: "PAID",
              razorpayPaymentId: body.razorpay_payment_id,
              // Auto-confirm on successful payment
              ...(order.status === "PENDING" ? { status: "CONFIRMED" } : {}),
            },
          });
          // Log the status transition
          if (order.status === "PENDING") {
            await tx.orderStatusLog.create({
              data: { orderId: order.id, status: "CONFIRMED", note: "Payment verified" },
            });
          }
          return ord;
        });

        if (order.status === "PENDING") {
          sendOrderStatusNotification(app.fcm, app.prisma, order.id, order.userId, "CONFIRMED");
        }
        broadcastOrderUpdate(app.prisma, order.id, updated.status);

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

  // Delivery Board — grouped orders for operational management
  app.get(
    "/delivery-board",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER", "STAFF")] },
    async (request, reply) => {
      const { storeId, date } = request.query as { storeId?: string; date?: string };
      if (!storeId) return reply.badRequest("storeId is required");

      if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
        return reply.forbidden("Access denied");
      }

      const targetDate = date ? new Date(date + "T00:00:00") : new Date();
      targetDate.setHours(0, 0, 0, 0);
      const startOfDay = new Date(targetDate);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      const dateStr = targetDate.toISOString().split("T")[0];

      const orderInclude = {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { name: true } } } },
        deliveryTrip: {
          select: {
            id: true,
            status: true,
            rider: { select: { id: true, name: true, phone: true } },
          },
        },
      };

      // Fetch all three groups in parallel
      const [expressOrders, scheduledOrders, pickupOrders, deliverySlots] = await Promise.all([
        // Express: DELIVERY fulfillment, no delivery slot, created today
        app.prisma.order.findMany({
          where: {
            storeId,
            fulfillmentType: "DELIVERY",
            deliverySlotId: null,
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
          include: orderInclude,
          orderBy: { createdAt: "desc" },
        }),
        // Scheduled: has deliverySlotId, scheduledDate matches target
        app.prisma.order.findMany({
          where: {
            storeId,
            deliverySlotId: { not: null },
            scheduledDate: { gte: startOfDay, lte: endOfDay },
          },
          include: orderInclude,
          orderBy: { slotStartTime: "asc" },
        }),
        // Pickup: fulfillmentType=PICKUP, created today
        app.prisma.order.findMany({
          where: {
            storeId,
            fulfillmentType: "PICKUP",
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
          include: orderInclude,
          orderBy: { createdAt: "desc" },
        }),
        // All delivery slots for this store (for capacity info)
        app.prisma.deliverySlot.findMany({
          where: { storeId, isActive: true },
          orderBy: { startTime: "asc" },
        }),
      ]);

      // Build summary counts
      const countByStatus = (orders: typeof expressOrders) => {
        const counts = { total: orders.length, pending: 0, confirmed: 0, preparing: 0, ready: 0, outForDelivery: 0, delivered: 0, cancelled: 0 };
        for (const o of orders) {
          const s = o.status.toLowerCase();
          if (s === "pending") counts.pending++;
          else if (s === "confirmed") counts.confirmed++;
          else if (s === "preparing") counts.preparing++;
          else if (s === "ready") counts.ready++;
          else if (s === "out_for_delivery") counts.outForDelivery++;
          else if (s === "delivered") counts.delivered++;
          else if (s === "cancelled") counts.cancelled++;
        }
        return counts;
      };

      // Group scheduled orders by slot
      const scheduledBySlot: Record<string, {
        slotId: string;
        startTime: string;
        endTime: string;
        maxOrders: number;
        orders: typeof scheduledOrders;
      }> = {};

      for (const slot of deliverySlots) {
        const key = `${slot.startTime}-${slot.endTime}`;
        if (!scheduledBySlot[key]) {
          scheduledBySlot[key] = {
            slotId: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxOrders: slot.maxOrders,
            orders: [],
          };
        }
      }

      for (const order of scheduledOrders) {
        if (order.slotStartTime && order.slotEndTime) {
          const key = `${order.slotStartTime}-${order.slotEndTime}`;
          if (!scheduledBySlot[key]) {
            scheduledBySlot[key] = {
              slotId: order.deliverySlotId!,
              startTime: order.slotStartTime,
              endTime: order.slotEndTime,
              maxOrders: 20,
              orders: [],
            };
          }
          scheduledBySlot[key].orders.push(order);
        }
      }

      const response: ApiResponse<{
        date: string;
        summary: {
          total: number;
          express: ReturnType<typeof countByStatus>;
          scheduled: ReturnType<typeof countByStatus>;
          pickup: ReturnType<typeof countByStatus>;
        };
        express: typeof expressOrders;
        scheduled: typeof scheduledBySlot;
        pickup: typeof pickupOrders;
      }> = {
        success: true,
        data: {
          date: dateStr,
          summary: {
            total: expressOrders.length + scheduledOrders.length + pickupOrders.length,
            express: countByStatus(expressOrders),
            scheduled: countByStatus(scheduledOrders),
            pickup: countByStatus(pickupOrders),
          },
          express: expressOrders,
          scheduled: scheduledBySlot,
          pickup: pickupOrders,
        },
      };
      return response;
    },
  );

  // Bulk status update
  app.post(
    "/bulk-status",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER", "STAFF")] },
    async (request, reply) => {
      const body = bulkUpdateOrderStatusSchema.parse(request.body);

      const orders = await app.prisma.order.findMany({
        where: { id: { in: body.orderIds } },
        include: { items: true },
      });

      // Verify org access for all orders
      for (const order of orders) {
        if (!(await verifyStoreOrgAccess(request, app.prisma, order.storeId))) {
          return reply.forbidden(`Access denied for order ${order.id}`);
        }
      }

      const errors: { orderId: string; reason: string }[] = [];
      const validOrders: typeof orders = [];

      // Check which orders have valid transitions
      for (const orderId of body.orderIds) {
        const order = orders.find((o) => o.id === orderId);
        if (!order) {
          errors.push({ orderId, reason: "Order not found" });
          continue;
        }
        if (order.status === body.status) {
          errors.push({ orderId, reason: `Already ${body.status}` });
          continue;
        }
        const transitions = getValidTransitions(order.fulfillmentType);
        const allowed = transitions[order.status] ?? [];
        if (!allowed.includes(body.status)) {
          errors.push({ orderId, reason: `Cannot transition from ${order.status} to ${body.status}` });
          continue;
        }
        validOrders.push(order);
      }

      if (validOrders.length === 0) {
        const response: ApiResponse<{ updated: number; skipped: number; errors: typeof errors }> = {
          success: true,
          data: { updated: 0, skipped: errors.length, errors },
        };
        return response;
      }

      // Process valid orders in a transaction
      await app.prisma.$transaction(async (tx) => {
        for (const order of validOrders) {
          // Stock operations
          const stockItems = order.items.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.quantity,
          }));

          if (body.status === "DELIVERED") {
            for (const item of stockItems) {
              await tx.$executeRaw`
                UPDATE store_products
                SET stock = stock - ${item.quantity},
                    reserved_stock = reserved_stock - ${item.quantity}
                WHERE id = ${item.storeProductId}
              `;
            }
          } else if (body.status === "CANCELLED") {
            for (const item of stockItems) {
              await tx.$executeRaw`
                UPDATE store_products
                SET reserved_stock = reserved_stock - ${item.quantity}
                WHERE id = ${item.storeProductId}
                  AND reserved_stock >= ${item.quantity}
              `;
            }
          }

          const updateData: Record<string, unknown> = { status: body.status };

          // Auto-mark COD as PAID on delivery
          if (body.status === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus === "PENDING") {
            updateData.paymentStatus = "PAID";
          }

          await tx.order.update({
            where: { id: order.id },
            data: updateData,
          });

          await tx.orderStatusLog.create({
            data: { orderId: order.id, status: body.status, note: "Bulk status update" },
          });
        }
      });

      // Broadcast updates outside transaction
      for (const order of validOrders) {
        broadcastOrderUpdate(app.prisma, order.id, body.status);
      }

      const response: ApiResponse<{ updated: number; skipped: number; errors: typeof errors }> = {
        success: true,
        data: { updated: validOrders.length, skipped: errors.length, errors },
      };
      return response;
    },
  );
}
