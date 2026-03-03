import type { FastifyInstance } from "fastify";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  skipSubscriptionDateSchema,
  basketAddOnSchema,
  subscriptionItemOverrideSchema,
  subscriptionConfigSchema,
  orgSubscriptionConfigSchema,
} from "@martly/shared/schemas";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser, getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { sendNotification } from "../../services/notification.js";
import { calculateNextDeliveryDate, advanceNextDeliveryDate, isDeliveryDay } from "../../utils/subscription-dates.js";
import { todayIST, tomorrowIST, endOfDayUTC, parseDate, formatDate } from "../../utils/timezone.js";

const STORE_PRODUCT_INCLUDE = {
  storeProduct: {
    include: {
      product: { select: { id: true, name: true, imageUrl: true } },
      variant: { select: { id: true, name: true, unitType: true, unitValue: true, mrp: true } },
    },
  },
};

export async function subscriptionRoutes(app: FastifyInstance) {
  // ── Customer: Create subscription ────────────────────
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createSubscriptionSchema.parse(request.body);
    const user = request.user as { sub: string };

    // Validate store exists and get org
    const store = await app.prisma.store.findUnique({
      where: { id: body.storeId },
      select: {
        id: true,
        organizationId: true,
        subscriptionEnabled: true,
        subscriptionCutoffTime: true,
        organization: { select: { subscriptionEnabled: true } },
      },
    });
    if (!store) return reply.notFound("Store not found");

    // Check org + store subscription enabled
    if (!store.organization.subscriptionEnabled) {
      return reply.badRequest("Subscriptions are not enabled for this organization");
    }
    if (!store.subscriptionEnabled) {
      return reply.badRequest("Subscriptions are not enabled for this store");
    }

    // Validate all items exist and are active
    const storeProducts = await app.prisma.storeProduct.findMany({
      where: {
        id: { in: body.items.map((i) => i.storeProductId) },
        storeId: body.storeId,
        isActive: true,
      },
    });
    if (storeProducts.length !== body.items.length) {
      return reply.badRequest("One or more products are invalid or not available at this store");
    }

    const selectedDays = body.selectedDays ?? [];
    const startDate = body.startDate ? parseDate(body.startDate) : undefined;
    const nextDeliveryDate = calculateNextDeliveryDate(body.frequency, selectedDays, startDate);

    const subscription = await app.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          userId: user.sub,
          storeId: body.storeId,
          organizationId: store.organizationId,
          frequency: body.frequency as any,
          selectedDays,
          deliveryAddress: body.deliveryAddress,
          deliveryLat: body.deliveryLat,
          deliveryLng: body.deliveryLng,
          deliveryPincode: body.deliveryPincode,
          addressId: body.addressId,
          nextDeliveryDate,
          cutoffTime: store.subscriptionCutoffTime,
          autoPayWithWallet: body.autoPayWithWallet,
          items: {
            create: body.items.map((item) => ({
              storeProductId: item.storeProductId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: { include: STORE_PRODUCT_INCLUDE },
          store: { select: { id: true, name: true } },
        },
      });
      return sub;
    });

    sendNotification(app.fcm, app.prisma, {
      userId: user.sub,
      type: "GENERAL",
      title: "Subscription Created",
      body: `Your ${body.frequency.replace(/_/g, " ").toLowerCase()} subscription has been set up. First delivery on ${nextDeliveryDate.toLocaleDateString()}.`,
      data: { screen: "subscriptions", subscriptionId: subscription.id },
    });

    const response: ApiResponse<typeof subscription> = { success: true, data: subscription };
    return response;
  });

  // ── Customer: List my subscriptions ──────────────────
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    const { storeId } = request.query as { storeId?: string };

    const where: Record<string, unknown> = { userId: user.sub };
    if (storeId) where.storeId = storeId;

    const subscriptions = await app.prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: STORE_PRODUCT_INCLUDE },
        store: { select: { id: true, name: true } },
      },
    });

    // Attach pricing to each item
    const data = subscriptions.map((sub) => ({
      ...sub,
      items: sub.items.map((item) => {
        const sp = item.storeProduct;
        const pricing = calculateEffectivePrice(
          sp.price as unknown as number,
          sp.variant as Parameters<typeof calculateEffectivePrice>[1],
          sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
        );
        return { ...item, pricing };
      }),
    }));

    const response: ApiResponse<typeof data> = { success: true, data };
    return response;
  });

  // ── Customer: Subscription detail ────────────────────
  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };

    const subscription = await app.prisma.subscription.findUnique({
      where: { id: request.params.id },
      include: {
        items: { include: STORE_PRODUCT_INCLUDE },
        store: { select: { id: true, name: true } },
        skippedDates: { orderBy: { date: "asc" } },
      },
    });
    if (!subscription) return reply.notFound("Subscription not found");
    if (subscription.userId !== user.sub) return reply.forbidden("Access denied");

    // Attach pricing to items
    const itemsWithPricing = subscription.items.map((item) => {
      const sp = item.storeProduct;
      const pricing = calculateEffectivePrice(
        sp.price as unknown as number,
        sp.variant as Parameters<typeof calculateEffectivePrice>[1],
        sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      );
      return { ...item, pricing };
    });

    // Build calendar — window depends on frequency
    const calendarDays = subscription.frequency === "MONTHLY" ? 35
      : subscription.frequency === "BIWEEKLY" ? 21
      : 7;

    const today = todayIST();
    const calendar: { date: string; scheduled: boolean; skipped: boolean }[] = [];
    const skippedDateSet = new Set(
      subscription.skippedDates.map((s) => formatDate(s.date)),
    );

    for (let i = 1; i <= calendarDays; i++) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() + i);
      const dateStr = formatDate(day);
      const scheduled = isDeliveryDay(day, subscription.frequency, subscription.selectedDays, subscription.createdAt);
      calendar.push({
        date: dateStr,
        scheduled,
        skipped: skippedDateSet.has(dateStr),
      });
    }

    // Recent orders (limit 5)
    const recentOrders = await app.prisma.order.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    const data = {
      ...subscription,
      items: itemsWithPricing,
      calendar,
      recentOrders,
    };

    const response: ApiResponse<typeof data> = { success: true, data };
    return response;
  });

  // ── Customer: Update subscription ────────────────────
  app.patch<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    const body = updateSubscriptionSchema.parse(request.body);

    const existing = await app.prisma.subscription.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) return reply.notFound("Subscription not found");
    if (existing.userId !== user.sub) return reply.forbidden("Access denied");
    if (existing.status === "CANCELLED") return reply.badRequest("Cannot update a cancelled subscription");

    // Validate new items if provided
    if (body.items) {
      const storeProducts = await app.prisma.storeProduct.findMany({
        where: {
          id: { in: body.items.map((i) => i.storeProductId) },
          storeId: existing.storeId,
          isActive: true,
        },
      });
      if (storeProducts.length !== body.items.length) {
        return reply.badRequest("One or more products are invalid or not available at this store");
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.frequency) updateData.frequency = body.frequency;
    if (body.selectedDays !== undefined) updateData.selectedDays = body.selectedDays;
    if (body.deliveryAddress) updateData.deliveryAddress = body.deliveryAddress;
    if (body.deliveryLat !== undefined) updateData.deliveryLat = body.deliveryLat;
    if (body.deliveryLng !== undefined) updateData.deliveryLng = body.deliveryLng;
    if (body.deliveryPincode !== undefined) updateData.deliveryPincode = body.deliveryPincode;
    if (body.addressId !== undefined) updateData.addressId = body.addressId;
    if (body.autoPayWithWallet !== undefined) updateData.autoPayWithWallet = body.autoPayWithWallet;

    if (body.status === "PAUSED") {
      updateData.status = "PAUSED";
      if (body.pausedUntil) updateData.pausedUntil = parseDate(body.pausedUntil);
    } else if (body.status === "ACTIVE") {
      updateData.status = "ACTIVE";
      updateData.pausedUntil = null;
    }

    // Recalculate nextDeliveryDate on frequency change
    if (body.frequency || body.selectedDays !== undefined) {
      const freq = body.frequency ?? existing.frequency;
      const days = body.selectedDays ?? existing.selectedDays;
      updateData.nextDeliveryDate = calculateNextDeliveryDate(freq, days);
    }

    const subscription = await app.prisma.$transaction(async (tx) => {
      // Replace items if provided
      if (body.items) {
        await tx.subscriptionItem.deleteMany({ where: { subscriptionId: existing.id } });
        await tx.subscriptionItem.createMany({
          data: body.items.map((item) => ({
            subscriptionId: existing.id,
            storeProductId: item.storeProductId,
            quantity: item.quantity,
          })),
        });
      }

      return tx.subscription.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          items: { include: STORE_PRODUCT_INCLUDE },
          store: { select: { id: true, name: true } },
        },
      });
    });

    const response: ApiResponse<typeof subscription> = { success: true, data: subscription };
    return response;
  });

  // ── Customer: Cancel subscription ────────────────────
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };

    const existing = await app.prisma.subscription.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) return reply.notFound("Subscription not found");
    if (existing.userId !== user.sub) return reply.forbidden("Access denied");
    if (existing.status === "CANCELLED") return reply.badRequest("Subscription is already cancelled");

    const subscription = await app.prisma.subscription.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" },
    });

    sendNotification(app.fcm, app.prisma, {
      userId: user.sub,
      type: "GENERAL",
      title: "Subscription Cancelled",
      body: "Your subscription has been cancelled. You can create a new one anytime.",
      data: { screen: "subscriptions" },
    });

    const response: ApiResponse<typeof subscription> = { success: true, data: subscription };
    return response;
  });

  // ── Customer: Skip a date ────────────────────────────
  app.post<{ Params: { id: string } }>("/:id/skip", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    const body = skipSubscriptionDateSchema.parse(request.body);

    const subscription = await app.prisma.subscription.findUnique({
      where: { id: request.params.id },
    });
    if (!subscription) return reply.notFound("Subscription not found");
    if (subscription.userId !== user.sub) return reply.forbidden("Access denied");

    // Validate date is in the future
    const skipDate = parseDate(body.date);
    const today = todayIST();
    if (skipDate <= today) {
      return reply.badRequest("Skip date must be in the future");
    }

    // Check if already skipped
    const existingSkip = await app.prisma.subscriptionSkip.findUnique({
      where: { subscriptionId_date: { subscriptionId: subscription.id, date: skipDate } },
    });
    if (existingSkip) return reply.badRequest("This date is already skipped");

    const skip = await app.prisma.subscriptionSkip.create({
      data: {
        subscriptionId: subscription.id,
        date: skipDate,
        reason: body.reason,
      },
    });

    const response: ApiResponse<typeof skip> = { success: true, data: skip };
    return response;
  });

  // ── Customer: Unskip a date ──────────────────────────
  app.delete<{ Params: { id: string; date: string } }>(
    "/:id/skip/:date",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };

      const subscription = await app.prisma.subscription.findUnique({
        where: { id: request.params.id },
      });
      if (!subscription) return reply.notFound("Subscription not found");
      if (subscription.userId !== user.sub) return reply.forbidden("Access denied");

      // Validate date is in the future
      const unskipDate = parseDate(request.params.date);
      const today = todayIST();
      if (unskipDate <= today) {
        return reply.badRequest("Cannot unskip a past date");
      }

      const existing = await app.prisma.subscriptionSkip.findUnique({
        where: {
          subscriptionId_date: {
            subscriptionId: subscription.id,
            date: unskipDate,
          },
        },
      });
      if (!existing) return reply.notFound("Skip not found for this date");

      await app.prisma.subscriptionSkip.delete({
        where: { id: existing.id },
      });

      const response: ApiResponse<{ deleted: true }> = { success: true, data: { deleted: true } };
      return response;
    },
  );

  // ── Basket: Tomorrow's basket ────────────────────────
  app.get("/basket", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    const tomorrow = tomorrowIST();
    const tomorrowEnd = endOfDayUTC(tomorrow);

    // Get all active subscriptions for this user + store
    const subscriptions = await app.prisma.subscription.findMany({
      where: {
        userId: user.sub,
        storeId,
        status: "ACTIVE",
      },
      include: {
        items: { include: STORE_PRODUCT_INCLUDE },
        skippedDates: {
          where: { date: { gte: tomorrow, lte: tomorrowEnd } },
        },
      },
    });

    // Fetch overrides for tomorrow
    const activeSubIds = subscriptions
      .filter((sub) => sub.skippedDates.length === 0 && isDeliveryDay(tomorrow, sub.frequency, sub.selectedDays, sub.createdAt))
      .map((sub) => sub.id);

    const overrides = activeSubIds.length > 0
      ? await app.prisma.subscriptionItemOverride.findMany({
          where: {
            subscriptionId: { in: activeSubIds },
            deliveryDate: { gte: tomorrow, lte: tomorrowEnd },
          },
        })
      : [];

    const overrideMap = new Map<string, number>();
    for (const o of overrides) {
      overrideMap.set(`${o.subscriptionId}:${o.storeProductId}`, o.quantity);
    }

    // Aggregate subscription items where tomorrow is a delivery day and not skipped
    const subscriptionItems: {
      storeProductId: string;
      quantity: number;
      subscriptionId: string;
      storeProduct: any;
      pricing: any;
      isOverridden: boolean;
      defaultQuantity: number;
    }[] = [];

    for (const sub of subscriptions) {
      const isSkipped = sub.skippedDates.length > 0;
      if (isSkipped) continue;

      const deliveryDay = isDeliveryDay(tomorrow, sub.frequency, sub.selectedDays, sub.createdAt);
      if (!deliveryDay) continue;

      for (const item of sub.items) {
        const overrideKey = `${sub.id}:${item.storeProductId}`;
        const hasOverride = overrideMap.has(overrideKey);
        const overrideQty = hasOverride ? overrideMap.get(overrideKey)! : item.quantity;

        // Skip items with override quantity = 0
        if (overrideQty === 0) continue;

        const sp = item.storeProduct;
        const pricing = calculateEffectivePrice(
          sp.price as unknown as number,
          sp.variant as Parameters<typeof calculateEffectivePrice>[1],
          sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
        );
        subscriptionItems.push({
          storeProductId: item.storeProductId,
          quantity: overrideQty,
          subscriptionId: sub.id,
          storeProduct: sp,
          pricing,
          isOverridden: hasOverride,
          defaultQuantity: item.quantity,
        });
      }
    }

    // Get add-on items for tomorrow
    const addOns = await app.prisma.basketAddOn.findMany({
      where: {
        userId: user.sub,
        storeId,
        deliveryDate: { gte: tomorrow, lte: tomorrowEnd },
      },
      include: {
        storeProduct: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true } },
            variant: { select: { id: true, name: true, unitType: true, unitValue: true, mrp: true } },
          },
        },
      },
    });

    const addOnItems = addOns.map((addon) => {
      const sp = addon.storeProduct;
      const pricing = calculateEffectivePrice(
        sp.price as unknown as number,
        sp.variant as Parameters<typeof calculateEffectivePrice>[1],
        sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
      );
      return {
        id: addon.id,
        storeProductId: addon.storeProductId,
        quantity: addon.quantity,
        isAddOn: true,
        storeProduct: sp,
        pricing,
      };
    });

    // Calculate totals
    let itemsTotal = 0;
    for (const item of subscriptionItems) {
      itemsTotal += item.pricing.effectivePrice * item.quantity;
    }
    for (const item of addOnItems) {
      itemsTotal += item.pricing.effectivePrice * item.quantity;
    }

    // Delivery fee
    const store = await app.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        baseDeliveryFee: true,
        subscriptionCutoffTime: true,
        freeDeliveryThreshold: true,
        subscriptionWindowStart: true,
        subscriptionWindowEnd: true,
      },
    });
    let deliveryFee = store?.baseDeliveryFee ? Number(store.baseDeliveryFee) : 0;
    if (store?.freeDeliveryThreshold && itemsTotal >= Number(store.freeDeliveryThreshold)) {
      deliveryFee = 0;
    }

    // Wallet balance
    const userData = await app.prisma.user.findUnique({
      where: { id: user.sub },
      select: { walletBalance: true },
    });
    const walletBalance = Number(userData?.walletBalance ?? 0);

    const totalAmount = itemsTotal + deliveryFee;
    const cutoffTime = store?.subscriptionCutoffTime ?? "22:00";

    // Merge into unified items array with source field
    const items = [
      ...subscriptionItems.map((item) => ({
        storeProductId: item.storeProductId,
        quantity: item.quantity,
        source: "subscription" as const,
        subscriptionId: item.subscriptionId,
        product: item.storeProduct.product,
        variant: item.storeProduct.variant,
        pricing: item.pricing,
        isOverridden: item.isOverridden,
        defaultQuantity: item.defaultQuantity,
      })),
      ...addOnItems.map((item) => ({
        storeProductId: item.storeProductId,
        quantity: item.quantity,
        source: "addon" as const,
        product: item.storeProduct.product,
        variant: item.storeProduct.variant,
        pricing: item.pricing,
      })),
    ];

    const data = {
      deliveryDate: formatDate(tomorrow),
      cutoffTime,
      deliveryWindowStart: store?.subscriptionWindowStart ?? null,
      deliveryWindowEnd: store?.subscriptionWindowEnd ?? null,
      items,
      subtotal: Math.round(itemsTotal * 100) / 100,
      deliveryFee,
      total: Math.round(totalAmount * 100) / 100,
      walletBalance,
      hasActiveSubscriptions: subscriptions.length > 0,
    };

    const response: ApiResponse<typeof data> = { success: true, data };
    return response;
  });

  // ── Basket: Add one-time add-on ──────────────────────
  app.post("/basket/items", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    const body = basketAddOnSchema.parse(request.body);

    const tomorrow = tomorrowIST();
    const deliveryDate = body.deliveryDate ? parseDate(body.deliveryDate) : tomorrow;

    // Validate store product
    const sp = await app.prisma.storeProduct.findUnique({
      where: { id: body.storeProductId },
      select: { id: true, storeId: true, isActive: true },
    });
    if (!sp || !sp.isActive) return reply.badRequest("Product not available");

    const addOn = await app.prisma.basketAddOn.upsert({
      where: {
        userId_storeId_storeProductId_deliveryDate: {
          userId: user.sub,
          storeId: sp.storeId,
          storeProductId: body.storeProductId,
          deliveryDate,
        },
      },
      create: {
        userId: user.sub,
        storeId: sp.storeId,
        storeProductId: body.storeProductId,
        quantity: body.quantity,
        deliveryDate,
      },
      update: {
        quantity: body.quantity,
      },
      include: {
        storeProduct: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true } },
            variant: { select: { id: true, name: true, unitType: true, unitValue: true, mrp: true } },
          },
        },
      },
    });

    const response: ApiResponse<typeof addOn> = { success: true, data: addOn };
    return response;
  });

  // ── Basket: Update add-on quantity ───────────────────
  app.patch<{ Params: { spId: string } }>(
    "/basket/items/:spId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { quantity } = request.body as { quantity: number };
      if (!quantity || quantity < 1) return reply.badRequest("quantity must be a positive integer");

      const tomorrow = tomorrowIST();
      const tomorrowEnd = endOfDayUTC(tomorrow);

      const existing = await app.prisma.basketAddOn.findFirst({
        where: {
          userId: user.sub,
          storeProductId: request.params.spId,
          deliveryDate: { gte: tomorrow, lte: tomorrowEnd },
        },
      });
      if (!existing) return reply.notFound("Add-on item not found");

      const updated = await app.prisma.basketAddOn.update({
        where: { id: existing.id },
        data: { quantity },
        include: {
          storeProduct: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
              variant: { select: { id: true, name: true, unitType: true, unitValue: true, mrp: true } },
            },
          },
        },
      });

      const response: ApiResponse<typeof updated> = { success: true, data: updated };
      return response;
    },
  );

  // ── Basket: Remove add-on ────────────────────────────
  app.delete<{ Params: { spId: string } }>(
    "/basket/items/:spId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };

      const tomorrow = tomorrowIST();
      const tomorrowEnd = endOfDayUTC(tomorrow);

      const existing = await app.prisma.basketAddOn.findFirst({
        where: {
          userId: user.sub,
          storeProductId: request.params.spId,
          deliveryDate: { gte: tomorrow, lte: tomorrowEnd },
        },
      });
      if (!existing) return reply.notFound("Add-on item not found");

      await app.prisma.basketAddOn.delete({ where: { id: existing.id } });

      const response: ApiResponse<{ deleted: true }> = { success: true, data: { deleted: true } };
      return response;
    },
  );

  // ── Basket: Override subscription item quantity ──
  app.put("/basket/override", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    const body = subscriptionItemOverrideSchema.parse(request.body);

    const tomorrow = tomorrowIST();
    const tomorrowEnd = endOfDayUTC(tomorrow);

    // Validate subscription belongs to user
    const subscription = await app.prisma.subscription.findUnique({
      where: { id: body.subscriptionId },
      include: { items: true },
    });
    if (!subscription) return reply.notFound("Subscription not found");
    if (subscription.userId !== user.sub) return reply.forbidden("Access denied");
    if (subscription.status !== "ACTIVE") return reply.badRequest("Subscription is not active");

    // Validate storeProduct is in subscription items
    const subItem = subscription.items.find((i) => i.storeProductId === body.storeProductId);
    if (!subItem) return reply.badRequest("Product is not in this subscription");

    // If quantity matches default, delete override (keep data clean)
    if (body.quantity === subItem.quantity) {
      await app.prisma.subscriptionItemOverride.deleteMany({
        where: {
          subscriptionId: body.subscriptionId,
          storeProductId: body.storeProductId,
          deliveryDate: { gte: tomorrow, lte: tomorrowEnd },
        },
      });
      const response: ApiResponse<{ reset: true }> = { success: true, data: { reset: true } };
      return response;
    }

    const override = await app.prisma.subscriptionItemOverride.upsert({
      where: {
        subscriptionId_storeProductId_deliveryDate: {
          subscriptionId: body.subscriptionId,
          storeProductId: body.storeProductId,
          deliveryDate: tomorrow,
        },
      },
      create: {
        subscriptionId: body.subscriptionId,
        storeProductId: body.storeProductId,
        quantity: body.quantity,
        deliveryDate: tomorrow,
      },
      update: {
        quantity: body.quantity,
      },
    });

    const response: ApiResponse<typeof override> = { success: true, data: override };
    return response;
  });

  // ── Basket: Reset subscription item override ───
  app.delete<{ Params: { subscriptionId: string; storeProductId: string } }>(
    "/basket/override/:subscriptionId/:storeProductId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { subscriptionId, storeProductId } = request.params;

      const tomorrow = tomorrowIST();
      const tomorrowEnd = endOfDayUTC(tomorrow);

      // Validate subscription belongs to user
      const subscription = await app.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (!subscription) return reply.notFound("Subscription not found");
      if (subscription.userId !== user.sub) return reply.forbidden("Access denied");

      const deleted = await app.prisma.subscriptionItemOverride.deleteMany({
        where: {
          subscriptionId,
          storeProductId,
          deliveryDate: { gte: tomorrow, lte: tomorrowEnd },
        },
      });

      if (deleted.count === 0) return reply.notFound("No override found for this item");

      const response: ApiResponse<{ deleted: true }> = { success: true, data: { deleted: true } };
      return response;
    },
  );

  // ── Admin: List subscriptions ────────────────────────
  app.get(
    "/admin",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request) => {
      const { page = 1, pageSize = 20, storeId, status, frequency, userId } = request.query as {
        page?: number; pageSize?: number; storeId?: string; status?: string; frequency?: string; userId?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);
      const user = getOrgUser(request);

      const where: Record<string, unknown> = {};

      // Org scoping
      if (user.role !== "SUPER_ADMIN") {
        const orgStoreIds = await getOrgStoreIds(request, app.prisma);
        if (orgStoreIds !== undefined) {
          where.storeId = storeId && orgStoreIds.includes(storeId)
            ? storeId
            : { in: orgStoreIds };
        }
      } else if (storeId) {
        where.storeId = storeId;
      }

      if (status) where.status = status;
      if (frequency) where.frequency = frequency;
      if (userId) where.userId = userId;

      const [subscriptions, total] = await Promise.all([
        app.prisma.subscription.findMany({
          where,
          skip,
          take: Number(pageSize),
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            store: { select: { id: true, name: true } },
            items: {
              include: {
                storeProduct: {
                  include: {
                    product: { select: { name: true } },
                    variant: { select: { name: true, unitType: true, unitValue: true } },
                  },
                },
              },
            },
          },
        }),
        app.prisma.subscription.count({ where }),
      ]);

      const response: PaginatedResponse<(typeof subscriptions)[0]> = {
        success: true,
        data: subscriptions,
        meta: {
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      };
      return response;
    },
  );

  // ── Admin: Subscription detail ───────────────────────
  app.get<{ Params: { id: string } }>(
    "/admin/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const subscription = await app.prisma.subscription.findUnique({
        where: { id: request.params.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          store: { select: { id: true, name: true } },
          items: { include: STORE_PRODUCT_INCLUDE },
          skippedDates: { orderBy: { date: "desc" } },
        },
      });
      if (!subscription) return reply.notFound("Subscription not found");

      // Verify org access
      if (!(await verifyStoreOrgAccess(request, app.prisma, subscription.storeId))) {
        return reply.forbidden("Access denied");
      }

      // Order history
      const orders = await app.prisma.order.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
        },
      });

      const data = { ...subscription, orders };
      const response: ApiResponse<typeof data> = { success: true, data };
      return response;
    },
  );

  // ── Admin: Update subscription (pause/resume/update items) ──
  app.put<{ Params: { id: string } }>(
    "/admin/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const body = request.body as {
        status?: "ACTIVE" | "PAUSED" | "CANCELLED";
        pausedUntil?: string;
        items?: Array<{ storeProductId: string; quantity: number }>;
      };

      const existing = await app.prisma.subscription.findUnique({
        where: { id: request.params.id },
        include: { items: true },
      });
      if (!existing) return reply.notFound("Subscription not found");

      // Verify org access
      if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
        return reply.forbidden("Access denied");
      }

      const updateData: Record<string, unknown> = {};

      if (body.status === "PAUSED") {
        updateData.status = "PAUSED";
        if (body.pausedUntil) updateData.pausedUntil = new Date(body.pausedUntil);
      } else if (body.status === "ACTIVE") {
        updateData.status = "ACTIVE";
        updateData.pausedUntil = null;
      } else if (body.status === "CANCELLED") {
        updateData.status = "CANCELLED";
      }

      const subscription = await app.prisma.$transaction(async (tx) => {
        // Update item quantities if provided
        if (body.items) {
          for (const item of body.items) {
            await tx.subscriptionItem.updateMany({
              where: { subscriptionId: existing.id, storeProductId: item.storeProductId },
              data: { quantity: item.quantity },
            });
          }
        }

        return tx.subscription.update({
          where: { id: existing.id },
          data: updateData,
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            store: { select: { id: true, name: true } },
            items: { include: STORE_PRODUCT_INCLUDE },
            skippedDates: { orderBy: { date: "desc" } },
          },
        });
      });

      // Attach order history
      const orders = await app.prisma.order.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, status: true, paymentStatus: true, totalAmount: true, createdAt: true },
      });

      const data = { ...subscription, orders };
      const response: ApiResponse<typeof data> = { success: true, data };
      return response;
    },
  );

  // ── Admin: Subscription stats ────────────────────────
  app.get(
    "/admin/stats",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request) => {
      const user = getOrgUser(request);
      const where: Record<string, unknown> = {};

      if (user.role !== "SUPER_ADMIN" && user.organizationId) {
        where.organizationId = user.organizationId;
      }

      const [active, paused, cancelled] = await Promise.all([
        app.prisma.subscription.count({ where: { ...where, status: "ACTIVE" } }),
        app.prisma.subscription.count({ where: { ...where, status: "PAUSED" } }),
        app.prisma.subscription.count({ where: { ...where, status: "CANCELLED" } }),
      ]);

      // Revenue from subscription orders (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const revenueWhere: Record<string, unknown> = {
        isSubscriptionOrder: true,
        status: "DELIVERED",
        createdAt: { gte: thirtyDaysAgo },
      };
      if (user.role !== "SUPER_ADMIN" && user.organizationId) {
        revenueWhere.store = { organizationId: user.organizationId };
      }

      const revenueResult = await app.prisma.order.aggregate({
        where: revenueWhere,
        _sum: { totalAmount: true },
        _count: true,
      });

      // Most popular products in subscriptions
      const popularWhere: Record<string, unknown> = {};
      if (user.role !== "SUPER_ADMIN" && user.organizationId) {
        popularWhere.subscription = { organizationId: user.organizationId };
      }

      const popularItems = await app.prisma.subscriptionItem.groupBy({
        by: ["storeProductId"],
        where: popularWhere,
        _count: { storeProductId: true },
        _sum: { quantity: true },
        orderBy: { _count: { storeProductId: "desc" } },
        take: 10,
      });

      // Fetch product details for popular items
      const popularStoreProducts = popularItems.length > 0
        ? await app.prisma.storeProduct.findMany({
            where: { id: { in: popularItems.map((i) => i.storeProductId) } },
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
              variant: { select: { id: true, name: true, unitType: true, unitValue: true } },
            },
          })
        : [];

      const popularProducts = popularItems.map((item) => {
        const sp = popularStoreProducts.find((p) => p.id === item.storeProductId);
        return {
          storeProductId: item.storeProductId,
          product: sp?.product,
          variant: sp?.variant,
          subscriptionCount: item._count.storeProductId,
          totalQuantity: item._sum.quantity,
        };
      });

      const data = {
        counts: { active, paused, cancelled, total: active + paused + cancelled },
        revenue: {
          last30Days: Number(revenueResult._sum.totalAmount ?? 0),
          orderCount: revenueResult._count,
        },
        popularProducts,
      };

      const response: ApiResponse<typeof data> = { success: true, data };
      return response;
    },
  );

  // ── Config: Get subscription config ──────────────────
  app.get(
    "/config",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const user = getOrgUser(request);
      let orgId = user.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        if (!organizationId) return reply.badRequest("organizationId required");
        orgId = organizationId;
      }

      const org = await app.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, subscriptionEnabled: true },
      });
      if (!org) return reply.notFound("Organization not found");

      const stores = await app.prisma.store.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          subscriptionEnabled: true,
          subscriptionDeliveryMode: true,
          subscriptionWindowStart: true,
          subscriptionWindowEnd: true,
          subscriptionCutoffTime: true,
        },
      });

      const data = { organization: org, stores };
      const response: ApiResponse<typeof data> = { success: true, data };
      return response;
    },
  );

  // ── Config: Update org subscription toggle ───────────
  app.patch(
    "/config/org",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const user = getOrgUser(request);
      let orgId = user.organizationId;
      if (!orgId) {
        const { organizationId } = request.query as { organizationId?: string };
        if (!organizationId) return reply.badRequest("organizationId required");
        orgId = organizationId;
      }

      const body = orgSubscriptionConfigSchema.parse(request.body);

      const org = await app.prisma.organization.update({
        where: { id: orgId },
        data: { subscriptionEnabled: body.subscriptionEnabled },
        select: { id: true, name: true, subscriptionEnabled: true },
      });

      const response: ApiResponse<typeof org> = { success: true, data: org };
      return response;
    },
  );

  // ── Config: Update store subscription config ─────────
  app.patch<{ Params: { storeId: string } }>(
    "/config/store/:storeId",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { storeId } = request.params;

      // Verify org access
      if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
        return reply.forbidden("Access denied");
      }

      const body = subscriptionConfigSchema.parse(request.body);

      const store = await app.prisma.store.update({
        where: { id: storeId },
        data: {
          subscriptionEnabled: body.subscriptionEnabled,
          subscriptionDeliveryMode: body.subscriptionDeliveryMode as any,
          subscriptionWindowStart: body.subscriptionWindowStart,
          subscriptionWindowEnd: body.subscriptionWindowEnd,
          subscriptionCutoffTime: body.subscriptionCutoffTime,
        },
        select: {
          id: true,
          name: true,
          subscriptionEnabled: true,
          subscriptionDeliveryMode: true,
          subscriptionWindowStart: true,
          subscriptionWindowEnd: true,
          subscriptionCutoffTime: true,
        },
      });

      const response: ApiResponse<typeof store> = { success: true, data: store };
      return response;
    },
  );
}
