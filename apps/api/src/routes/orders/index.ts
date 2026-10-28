import type { FastifyInstance } from "fastify";
import { Prisma } from "../../../generated/prisma/index.js";
import { createOrderSchema, updateOrderStatusSchema, updatePaymentStatusSchema, verifyPaymentSchema, bulkUpdateOrderStatusSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { transitionDenial } from "../../services/order-access.js";
import { releaseFromUnstartedTrip, stopFinished } from "../../services/delivery/trip-ops.js";
import { reoptimizeTrips } from "../../services/delivery/plan-wave.js";
import { undoDeliveryRoutes } from "./undo-delivery.js";
import { OPEN_ORDER_STATUSES, addDays, istDay, istNow, istWeekday } from "../../services/ist-day.js";
import { slotCapacity } from "../../services/delivery/settings.js";
import { deliveryFeeTo, expressOutsideHours } from "../../services/delivery/fee.js";
import { hasPermission } from "@martly/shared/permissions";
import { getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { locateAddress } from "../../lib/geo.js";
import { sendOrderStatusNotification, sendWalletNotification, sendLoyaltyNotification, sendNotification } from "../../services/notification.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { checkCoupon } from "../../services/coupons.js";
import { reserveStock, releaseStock } from "../../services/stock.js";
import { deliverWithRefusals } from "../../services/returns/door-refusal.js";
import { postDeliveryEntries } from "../../services/ledger/order.js";
import { attachReplacements, reopenReplacements } from "../../services/returns/replacement.js";
import { pendingPickups } from "../../services/returns/pickups.js";
import { notifyReplacementRefunds } from "../../services/notify/return-alerts.js";
import { formatVariantUnit } from "../../services/units.js";
import { verifyRazorpaySignature, isRazorpayConfigured, getRazorpayKeyId, isUpiS2SEnabled } from "../../services/payment.js";
import { prepareOrderPayment, settleOrderPayment } from "../../services/order-payment.js";
import { upiPaymentRoutes } from "./upi-payment.js";
import { reorderRoutes } from "./reorder.js";
import { broadcastOrderUpdate } from "../../services/order-broadcast.js";
import { notifyStaffOfNewOrder } from "../../services/staff-alerts.js";
import { formatOrderRef } from "../../services/notify/copy.js";
import { notifyOrderPlaced, notifyPaymentFailed, notifySlotFullIfNeeded } from "../../services/notify/order-alerts.js";
import { applyCancelRefunds, cancelOrder, notifyOrderCancelled } from "../../services/order-cancel.js";
import { DELIVERY_TRANSITIONS, PICKUP_TRANSITIONS } from "@martly/shared/order-flow";
import { freeUnits, lineTotal } from "@martly/shared/offers";
import { OrderStatus, Permission } from "@martly/shared/constants";
import { recordMonthlyListOrder } from "../../services/monthly-list/index.js";

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

/** Shoppers see their own orders; staff need the orders permission */
function canViewOrders(user: { role: string; permissions?: readonly string[] }): boolean {
  return user.role === "CUSTOMER" || user.role === "SUPER_ADMIN" || hasPermission(user.permissions, Permission.ORDERS_VIEW);
}

export async function orderRoutes(app: FastifyInstance) {
  /** A cancelled stop left a gap in its trip: put the rest back in road order (in the background, best effort) */
  const reorderTripAfterCancel = (tripId: string | null) => {
    if (!tripId) return;
    reoptimizeTrips(app.prisma, [tripId]).catch((err: unknown) => app.log.error(err, `Re-ordering trip ${tripId} failed`));
  };

  await app.register(undoDeliveryRoutes);
  await app.register(upiPaymentRoutes);
  await app.register(reorderRoutes);

  // List orders (scoped by role + org)
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const {
      page = 1, pageSize = 20, userId, storeId, status, paymentStatus, paymentMethod, fulfillmentType, q,
      dateFrom, dateTo, sortBy, sortOrder,
    } = request.query as {
      page?: number; pageSize?: number; userId?: string; storeId?: string; status?: string;
      paymentStatus?: string; paymentMethod?: string; fulfillmentType?: string; q?: string;
      dateFrom?: string; dateTo?: string; sortBy?: string; sortOrder?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const user = getOrgUser(request);
    if (!canViewOrders(user)) return reply.forbidden("You don't have permission to view orders");

    const where: Record<string, unknown> = {};

    if (user.role === "CUSTOMER") {
      where.userId = user.sub;
    } else {
      if (userId) where.userId = userId;
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      if (orgStoreIds !== undefined) where.storeId = { in: orgStoreIds };
    }

    if (storeId && user.role !== "CUSTOMER") {
      if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
      where.storeId = storeId;
    }
    // Accepts one status or a comma-separated list, e.g. "PENDING,CONFIRMED" for active orders
    if (status) {
      const statuses = status.split(",");
      if (!statuses.every((s) => s in OrderStatus)) return reply.badRequest("Invalid order status");
      where.status = statuses.length > 1 ? { in: statuses } : status;
    }
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
        orderBy: [orderBy, { id: "asc" }],
        include: {
          items: { include: { product: true, variant: true } },
          user: { select: { id: true, name: true, email: true } },
          returnRequest: { select: { status: true, remedy: true, method: true, approvedAmount: true } },
          store: { select: { id: true, name: true, translations: true, logoUrl: true } },
          deliveryTrip: { select: { rider: { select: { name: true, phone: true } } } },
          storeRatings: { select: { id: true } },
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
        items: { include: { product: true, variant: true, replacesReturn: { select: { orderId: true, reason: true } } } },
        statusLogs: { orderBy: { createdAt: "asc" } },
        returnRequest: { select: { id: true, status: true, requestedAmount: true, approvedAmount: true, remedy: true, method: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        deliveryTrip: { select: { id: true, status: true, rider: { select: { name: true, phone: true } } } },
      },
    });
    if (!order) return reply.notFound("Order not found");

    const user = getOrgUser(request);
    if (!canViewOrders(user)) return reply.forbidden("You don't have permission to view orders");
    if (user.role === "CUSTOMER") {
      if (order.userId !== user.sub) return reply.forbidden("Access denied");
    } else if (user.role !== "SUPER_ADMIN") {
      if (!(await verifyStoreOrgAccess(request, app.prisma, order.storeId))) {
        return reply.forbidden("Access denied");
      }
    }

    // Returned items the rider should collect when this order goes out
    const open = order.status !== "DELIVERED" && order.status !== "CANCELLED";
    const pickups = open ? ((await pendingPickups(app.prisma, [{ userId: order.userId, storeId: order.storeId }])).get(`${order.userId}:${order.storeId}`) ?? []) : [];
    const data = { ...formatOrderUnits(order), pickups };
    const response: ApiResponse<typeof data> = { success: true, data };
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
      select: { organizationId: true, name: true, address: true, latitude: true, longitude: true, deliveryRadius: true, minOrderAmount: true, freeDeliveryThreshold: true, baseDeliveryFee: true },
    });
    if (!store) return reply.notFound("Store not found");

    // Resolve delivery address from addressId or direct input
    let deliveryAddress: string | null = null;
    let deliveryPincode: string | null = null;
    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;
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
        deliveryLat = addr.latitude ?? null;
        deliveryLng = addr.longitude ?? null;
      }
      if (deliveryLat === null && body.deliveryAddressLat != null && body.deliveryAddressLng != null) {
        deliveryLat = body.deliveryAddressLat;
        deliveryLng = body.deliveryAddressLng;
      }
      // Trips are planned by location, so an address without coordinates is looked up once, here
      if (deliveryLat === null && deliveryAddress) {
        const found = await locateAddress(deliveryAddress, deliveryPincode);
        if (found) {
          deliveryLat = found.lat;
          deliveryLng = found.lng;
          deliveryPincode = deliveryPincode ?? found.pincode ?? null;
        }
      }
    }

    // Check active membership for member benefits
    const orderStore = await app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } });
    const activeMembership = orderStore
      ? await app.prisma.userMembership.findFirst({
          where: { userId: user.sub, organizationId: orderStore.organizationId, status: "ACTIVE", endDate: { gt: new Date() } },
          include: { plan: true },
        })
      : null;
    const userIsMember = !!activeMembership;
    const membershipPlan = activeMembership?.plan ?? null;

    const storeProducts = await app.prisma.storeProduct.findMany({
      where: { id: { in: body.items.map((i) => i.storeProductId) }, storeId: body.storeId, isActive: true },
      include: { variant: true },
    });
    // A hidden or not-carried listing can still sit in an old cart
    if (storeProducts.length !== new Set(body.items.map((i) => i.storeProductId)).size) {
      return reply.badRequest("Some items in your cart are no longer sold at this store");
    }

    let itemsTotal = 0;

    const itemsData = body.items.map((item) => {
      const sp = storeProducts.find((sp) => sp.id === item.storeProductId)!;
      const pricing = calculateEffectivePrice(
        sp.price as unknown as number,
        sp.variant as Parameters<typeof calculateEffectivePrice>[1],
        sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      );
      // Member pricing: use memberPrice if lower than effectivePrice
      let unitPrice = pricing.effectivePrice;
      const spMemberPrice = (sp as unknown as { memberPrice: unknown }).memberPrice;
      if (userIsMember && spMemberPrice != null) {
        const mp = Number(spMemberPrice);
        if (mp < unitPrice) unitPrice = mp;
      }
      const freeQuantity = freeUnits(item.quantity, pricing.offer);
      const totalPrice = lineTotal(unitPrice, item.quantity, pricing.offer);
      itemsTotal += totalPrice;
      return {
        storeProductId: item.storeProductId,
        productId: sp.productId,
        variantId: sp.variantId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        freeQuantity,
        originalPrice: pricing.discountActive ? pricing.originalPrice : undefined,
        discountType: pricing.discountType ?? undefined,
        discountValue: pricing.discountValue ?? undefined,
        sourceSectionId: item.source?.sectionId,
        sourceSectionType: item.source?.sectionType,
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
    let couponRecord: Prisma.CouponGetPayload<object> | null = null;

    // An invalid coupon is dropped rather than failing the order; the app checked it a moment ago
    if (body.couponCode) {
      couponRecord = await app.prisma.coupon.findUnique({ where: { code: body.couponCode.toUpperCase() } });
      const check = couponRecord && store
        && await checkCoupon(app.prisma, couponRecord, { userId: user.sub, organizationId: store.organizationId, orderAmount: itemsTotal });
      if (couponRecord && check && check.ok) {
        couponId = couponRecord.id;
        couponCode = couponRecord.code;
        couponDiscount = check.discount;
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

      const delivery = await deliveryFeeTo(app.prisma, body.storeId, store, deliveryLat != null && deliveryLng != null ? { lat: deliveryLat, lng: deliveryLng } : null);
      deliveryDistance = delivery.distance;
      if (delivery.outOfRange) {
        return reply.status(400).send({
          success: false,
          error: "Not Serviceable",
          message: `Delivery address is ${delivery.distance!.toFixed(1)} km away, which exceeds the store's delivery radius of ${store.deliveryRadius} km`,
          statusCode: 400,
        });
      }
      deliveryFee = delivery.fee;
      estimatedMinutes = delivery.estimatedMinutes;
    }

    // Free delivery threshold override
    if (!isPickup && store?.freeDeliveryThreshold && itemsTotal >= Number(store.freeDeliveryThreshold)) {
      deliveryFee = 0;
    }

    // Membership free delivery override
    if (!isPickup && userIsMember && membershipPlan?.freeDelivery) {
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

        if (expressOutsideHours(expressConfig)) {
          return reply.status(400).send({
            success: false,
            error: "Express Unavailable",
            message: "Express delivery is outside operating hours",
            statusCode: 400,
          });
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

      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.scheduledDate)) return reply.badRequest("Invalid scheduledDate format");
      // Slot days and cutoffs are India time, whatever zone the server runs in
      const now = istNow();
      if (body.scheduledDate < now.key || body.scheduledDate > addDays(now.key, 7)) {
        return reply.badRequest("Scheduled date must be within 7 days");
      }
      if (istWeekday(body.scheduledDate) !== slot.dayOfWeek) {
        return reply.badRequest("Scheduled date does not match slot day of week");
      }
      const [h, m] = slot.startTime.split(":").map(Number);
      if (body.scheduledDate === now.key && now.minutes >= h * 60 + m - slot.cutoffMinutes) {
        return reply.badRequest("This slot is past its booking cutoff time");
      }

      // A slot only takes what its riders can carry
      const { start: startOfDay, end: endOfDay } = istDay(body.scheduledDate);
      const bookedCount = await app.prisma.order.count({
        where: {
          deliverySlotId: body.deliverySlotId,
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: { not: "CANCELLED" },
        },
      });
      if (bookedCount >= await slotCapacity(app.prisma, slot, body.scheduledDate)) {
        return reply.badRequest("This delivery slot is full");
      }
      const parsedDate = new Date(`${body.scheduledDate}T00:00:00+05:30`);

      deliverySlotId = slot.id;
      scheduledDate = parsedDate;
      slotStartTime = slot.startTime;
      slotEndTime = slot.endTime;

      // estimatedDeliveryAt comes from the slot start instead
      estimatedMinutes = undefined;
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
            deliveryLat: deliveryLat ?? undefined,
            deliveryLng: deliveryLng ?? undefined,
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
            // Slot start on the booked day, in India time
            estimatedDeliveryAt: body.scheduledDate && slotStartTime
              ? new Date(`${body.scheduledDate}T${slotStartTime}:00+05:30`)
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
              reason: "ORDER_PAYMENT",
              organizationId: store.organizationId,
              storeId: body.storeId,
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

        const replacements = await attachReplacements(tx, { id: newOrder.id, userId: user.sub, storeId: body.storeId });
        return { order: newOrder, walletFullyCovered, walletDeduction, loyaltyDeduction, remainingAmount, replacements };
      });
      notifyReplacementRefunds(app, result.replacements);

      // COD and fully wallet-paid orders need the store's attention now; online orders alert once paid
      broadcastOrderUpdate(app.prisma, result.order.id, result.order.status);
      if (result.order.paymentMethod === "COD" || result.walletFullyCovered) {
        notifyStaffOfNewOrder(app.fcm, app.prisma, result.order.id);
        notifyOrderPlaced(app, result.order.id);
      }
      if (result.order.deliverySlotId && body.scheduledDate) notifySlotFullIfNeeded(app, result.order.deliverySlotId, body.scheduledDate);
      if (body.monthlyListId) await recordMonthlyListOrder(app.prisma, body.monthlyListId, user.sub, result.order.id);

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
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = updateOrderStatusSchema.parse(request.body);
      const existing = await app.prisma.order.findUnique({
        where: { id: request.params.id },
        include: { items: true, deliveryTrip: { select: { riderId: true } } },
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
      // Orders go out on a trip, so every one on the road has a rider
      if (body.status === "OUT_FOR_DELIVERY") {
        return reply.badRequest("Assign a rider to send this order out");
      }
      const denied = await transitionDenial(app.prisma, request.user, existing, body.status);
      if (denied) return reply.forbidden(denied);

      const stockItems = existing.items.map((i) => ({
        storeProductId: i.storeProductId,
        quantity: i.quantity,
      }));

      if (body.status === "CANCELLED") {
        await releaseStock(app.prisma, stockItems);
      }

      const txResult = await app.prisma.$transaction(async (tx) => {
        const refusal = body.status === "DELIVERED" ? await deliverWithRefusals(tx, existing, body.refused ?? [], request.user.sub) : null;
        const updateData: Record<string, unknown> = { status: body.status };
        if (refusal?.refusedAmount) updateData.refusedAmount = refusal.refusedAmount;

        // Delivering a COD order means the money was collected: cash in hand unless the rider says UPI
        if (body.status === "DELIVERED" && existing.paymentMethod === "COD" && existing.paymentStatus === "PENDING") {
          updateData.paymentStatus = "PAID";
          updateData.codCollectedVia = body.collectedVia ?? "CASH";
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
              // Check membership for loyalty multiplier
              const memberMembership = await tx.userMembership.findFirst({
                where: { userId: existing.userId, organizationId: orderStore.organizationId, status: "ACTIVE", endDate: { gt: new Date() } },
                include: { plan: true },
              });
              const loyaltyMultiplier = memberMembership?.plan?.loyaltyMultiplier ?? 1;
              const kept = Number(existing.totalAmount) - (refusal?.refusedAmount ?? 0);
              const pointsEarned = Math.floor(kept / 100 * loyaltyConfig.earnRate * loyaltyMultiplier);
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
        let referralId: string | null = null;
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
                      reason: "REFERRAL",
                      organizationId: orderStore.organizationId,
                      storeId: existing.storeId,
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
                      reason: "REFERRAL",
                      orderId: existing.id,
                      organizationId: orderStore.organizationId,
                      storeId: existing.storeId,
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
                referralId = pendingReferral.id;
                referralReferrerId = pendingReferral.referrerId;
                referralReferrerReward = rrReward;
                referralRefereeReward = reReward;
              }
            }
          }
        }

        if (body.status === "DELIVERED") {
          const referral = referralId ? { id: referralId, referrerReward: referralReferrerReward, refereeReward: referralRefereeReward } : null;
          await postDeliveryEntries(tx, existing, refusal ?? { refusedAmount: 0, walletCredit: 0 }, referral);
        }

        const refunds = body.status === "CANCELLED" ? await applyCancelRefunds(tx, existing, { reverseEarned: true }) : null;
        if (body.status === "CANCELLED") await reopenReplacements(tx, existing.id);
        if (refunds?.paymentRefunded) updateData.paymentStatus = "REFUNDED";

        const updated = await tx.order.update({
          where: { id: request.params.id },
          data: updateData,
          include: { items: true },
        });
        if (body.status === "CANCELLED") await releaseFromUnstartedTrip(tx, request.params.id);
        const paidNote = (body.status === "DELIVERED" && existing.paymentMethod === "COD" && existing.paymentStatus === "PENDING")
          ? (body.collectedVia === "UPI" ? "COD paid by UPI on delivery" : "COD collected in cash on delivery")
          : body.note;
        const logNote = [paidNote, refusal?.note].filter(Boolean).join(" · ") || undefined;
        await tx.orderStatusLog.create({
          data: { orderId: request.params.id, status: body.status, note: logNote },
        });

        return { updated, refunds, refusal, referralCompleted, referralReferrerId, referralReferrerReward, referralRefereeReward };
      });

      const order = txResult.updated;
      const { referralCompleted, referralReferrerId, referralReferrerReward, referralRefereeReward } = txResult;

      if (txResult.refunds) {
        notifyOrderCancelled(app, existing, { by: "store", reason: body.note, refunds: txResult.refunds, actorId: request.user.sub });
        reorderTripAfterCancel(existing.deliveryTripId);
      } else {
        sendOrderStatusNotification(app.fcm, app.prisma, order.id, body.status);
      }
      broadcastOrderUpdate(app.prisma, order.id, body.status);

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
          body: `Rate order ${formatOrderRef(existing.id)} and help others shop better.`,
          data: { screen: "order", orderId: existing.id },
        });

        if (txResult.refusal?.walletCredit) {
          sendWalletNotification(app.fcm, app.prisma, existing.userId, "CREDIT", txResult.refusal.walletCredit, "Refund for items handed back");
        }

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
      if (body.status === "DELIVERED" && existing.deliveryTripId) await stopFinished(app.prisma, app.fcm, existing.deliveryTripId);

      const response: ApiResponse<typeof order> = { success: true, data: order };
      return response;
    },
  );

  // Update payment status (admin override)
  app.patch<{ Params: { id: string } }>(
    "/:id/payment-status",
    { preHandler: [authenticate, requirePermission(Permission.FINANCE_MANAGE)] },
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
      const existing = await app.prisma.order.findUnique({ where: { id: request.params.id } });
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

      const order = await cancelOrder(app, existing.id, { by: "customer", note: "Cancelled by customer" });

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

      const user = request.user as { sub: string };
      const { rpOrderId, amountInPaise, customerId } = await prepareOrderPayment(app, request.params.id, user.sub);

      const response: ApiResponse<{
        razorpay_order_id: string;
        amount: number;
        currency: string;
        key_id: string;
        customer_id?: string;
        upi_s2s: boolean;
      }> = {
        success: true,
        data: {
          razorpay_order_id: rpOrderId,
          amount: amountInPaise,
          currency: "INR",
          key_id: getRazorpayKeyId(),
          ...(customerId ? { customer_id: customerId } : {}),
          upi_s2s: isUpiS2SEnabled(),
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
        const updated = await settleOrderPayment(app, order.id, body.razorpay_payment_id);

        const response: ApiResponse<typeof updated> = { success: true, data: updated };
        return response;
      } else {
        await app.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "FAILED" },
        });
        notifyPaymentFailed(app, order.id, body.razorpay_payment_id);

        return reply.badRequest("Payment verification failed");
      }
    },
  );

  // Delivery Board — grouped orders for operational management
  app.get(
    "/delivery-board",
    { preHandler: [authenticate, requirePermission(Permission.ORDERS_VIEW)] },
    async (request, reply) => {
      const { storeId, date } = request.query as { storeId?: string; date?: string };
      if (!storeId) return reply.badRequest("storeId is required");

      if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
        return reply.forbidden("Access denied");
      }

      const day = istDay(date);
      const dateStr = day.key;
      // Today's board also carries orders from earlier days that are still open, so nothing drops off overnight
      const createdOnDay = (field: "createdAt" | "scheduledDate") => ({
        OR: [
          { [field]: { gte: day.start, lte: day.end } },
          ...(day.isToday ? [{ [field]: { lt: day.start }, status: { in: [...OPEN_ORDER_STATUSES] } }] : []),
        ],
      });

      const orderInclude = {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { name: true, imageUrl: true, images: true } },
            variant: { select: { name: true, imageUrl: true } },
          },
        },
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
            ...createdOnDay("createdAt"),
          },
          include: orderInclude,
          orderBy: { createdAt: "desc" },
        }),
        // Scheduled: has deliverySlotId, scheduledDate matches target
        app.prisma.order.findMany({
          where: {
            storeId,
            deliverySlotId: { not: null },
            ...createdOnDay("scheduledDate"),
          },
          include: orderInclude,
          orderBy: { slotStartTime: "asc" },
        }),
        // Pickup: fulfillmentType=PICKUP, created today
        app.prisma.order.findMany({
          where: {
            storeId,
            fulfillmentType: "PICKUP",
            ...createdOnDay("createdAt"),
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
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = bulkUpdateOrderStatusSchema.parse(request.body);
      const denied = await transitionDenial(app.prisma, request.user, { deliveryTripId: null }, body.status);
      if (denied) return reply.forbidden(denied);

      const orders = await app.prisma.order.findMany({
        where: { id: { in: body.orderIds } },
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
          await tx.order.update({
            where: { id: order.id },
            data: { status: body.status },
          });

          await tx.orderStatusLog.create({
            data: { orderId: order.id, status: body.status, note: "Bulk status update" },
          });
        }
      });

      // Broadcast and tell each customer, outside the transaction
      for (const order of validOrders) {
        broadcastOrderUpdate(app.prisma, order.id, body.status);
        sendOrderStatusNotification(app.fcm, app.prisma, order.id, body.status);
      }

      const response: ApiResponse<{ updated: number; skipped: number; errors: typeof errors }> = {
        success: true,
        data: { updated: validOrders.length, skipped: errors.length, errors },
      };
      return response;
    },
  );

  // ── Payment Preferences ──────────────────────────────────
  app.get(
    "/payment-preferences",
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as { sub: string };
      const dbUser = await app.prisma.user.findUniqueOrThrow({
        where: { id: user.sub },
        select: { preferredPaymentMethod: true, lastUpiVpa: true, razorpayCustomerId: true },
      });

      const response: ApiResponse<{
        preferredPaymentMethod: string | null;
        lastUpiVpa: string | null;
        hasRazorpayCustomer: boolean;
      }> = {
        success: true,
        data: {
          preferredPaymentMethod: dbUser.preferredPaymentMethod,
          lastUpiVpa: dbUser.lastUpiVpa,
          hasRazorpayCustomer: Boolean(dbUser.razorpayCustomerId),
        },
      };
      return response;
    },
  );

  app.patch(
    "/payment-preferences",
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as { sub: string };
      const body = request.body as { preferredPaymentMethod?: string; lastUpiVpa?: string };

      const data: Record<string, string> = {};
      if (body.preferredPaymentMethod === "ONLINE" || body.preferredPaymentMethod === "COD") {
        data.preferredPaymentMethod = body.preferredPaymentMethod;
      }
      if (typeof body.lastUpiVpa === "string") {
        data.lastUpiVpa = body.lastUpiVpa;
      }

      const updated = await app.prisma.user.update({
        where: { id: user.sub },
        data,
        select: { preferredPaymentMethod: true, lastUpiVpa: true },
      });

      const response: ApiResponse<typeof updated> = { success: true, data: updated };
      return response;
    },
  );
}
