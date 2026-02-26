import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createOrderSchema, updateOrderStatusSchema, updatePaymentStatusSchema, verifyPaymentSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { haversine } from "../../lib/geo.js";
import { sendOrderStatusNotification } from "../../services/notification.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { reserveStock, releaseStock, deductStock } from "../../services/stock.js";
import { formatVariantUnit } from "../../services/units.js";
import { createRazorpayOrder, verifyRazorpaySignature, isRazorpayConfigured, getRazorpayKeyId } from "../../services/payment.js";

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
      select: { name: true, address: true, latitude: true, longitude: true, deliveryRadius: true },
    });

    // Resolve delivery address from addressId or direct input
    let deliveryAddress: string | null = null;
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
            estimatedDeliveryAt: estimatedMinutes ? new Date(Date.now() + estimatedMinutes * 60000) : undefined,
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

      const order = await app.prisma.$transaction(async (tx) => {
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

        return updated;
      });

      sendOrderStatusNotification(app.fcm, app.prisma, order.id, existing.userId, body.status);

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
