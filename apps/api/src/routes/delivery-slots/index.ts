import type { FastifyInstance } from "fastify";
import { createDeliverySlotSchema, updateDeliverySlotSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { addDays, istNow } from "../../services/ist-day.js";
import { notifySlotChanged, openSlotOrders } from "../../services/notify/delivery-alerts.js";
import { BOOKING_DAYS, slotsForDate } from "../../services/delivery/slot-availability.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function deliverySlotRoutes(app: FastifyInstance) {
  // GET / — List slots for a store (admin)
  app.get("/", {
    preHandler: [authenticate, requirePermission(Permission.DELIVERY_CONFIG, Permission.STORE_SETTINGS)],
  }, async (request, reply) => {
    const { storeId, page = 1, pageSize = 100 } = request.query as {
      storeId?: string; page?: number; pageSize?: number;
    };

    if (!storeId) {
      const response: PaginatedResponse<never> = {
        success: true,
        data: [],
        meta: { total: 0, page: 1, pageSize: Number(pageSize), totalPages: 0 },
      };
      return response;
    }

    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) {
      return reply.forbidden("Access denied");
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const where = { storeId };

    const [slots, total] = await Promise.all([
      app.prisma.deliverySlot.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      app.prisma.deliverySlot.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof slots)[0]> = {
      success: true,
      data: slots,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // POST / — Create a slot
  app.post("/", {
    preHandler: [authenticate, requirePermission(Permission.DELIVERY_CONFIG)],
  }, async (request, reply) => {
    const body = createDeliverySlotSchema.parse(request.body);

    if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) {
      return reply.forbidden("Access denied");
    }

    if (body.startTime >= body.endTime) {
      return reply.badRequest("startTime must be before endTime");
    }

    // Check for duplicate
    const existing = await app.prisma.deliverySlot.findUnique({
      where: {
        storeId_dayOfWeek_startTime_endTime: {
          storeId: body.storeId,
          dayOfWeek: body.dayOfWeek,
          startTime: body.startTime,
          endTime: body.endTime,
        },
      },
    });
    if (existing) {
      return reply.badRequest(`A slot for this day and time window already exists`);
    }

    const slot = await app.prisma.deliverySlot.create({ data: body });

    const response: ApiResponse<typeof slot> = { success: true, data: slot };
    return response;
  });

  // PATCH /:id — Update a slot
  app.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requirePermission(Permission.DELIVERY_CONFIG)],
  }, async (request, reply) => {
    const body = updateDeliverySlotSchema.parse(request.body);

    const existing = await app.prisma.deliverySlot.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Delivery slot not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
      return reply.forbidden("Access denied");
    }

    const newStart = body.startTime ?? existing.startTime;
    const newEnd = body.endTime ?? existing.endTime;
    if (newStart >= newEnd) {
      return reply.badRequest("startTime must be before endTime");
    }

    const slot = await app.prisma.deliverySlot.update({
      where: { id: request.params.id },
      data: body,
    });

    const moved = slot.dayOfWeek !== existing.dayOfWeek || slot.startTime !== existing.startTime || slot.endTime !== existing.endTime;
    if (moved) openSlotOrders(app.prisma, slot.id).then((orders) => notifySlotChanged(app.fcm, app.prisma, orders, slot)).catch((err: unknown) => app.log.error(err, "Slot change notifications failed"));

    const response: ApiResponse<typeof slot> = { success: true, data: slot };
    return response;
  });

  // DELETE /:id — Delete a slot
  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requirePermission(Permission.DELIVERY_CONFIG)],
  }, async (request, reply) => {
    const existing = await app.prisma.deliverySlot.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Delivery slot not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
      return reply.forbidden("Access denied");
    }

    // Deleting would turn its booked orders into express deliveries; turning it off keeps them in their slot
    const booked = await openSlotOrders(app.prisma, existing.id);
    if (booked.length > 0) {
      return reply.conflict(`${booked.length} upcoming ${booked.length === 1 ? "order is" : "orders are"} booked in this slot. Turn the slot off instead, so they keep their delivery time.`);
    }
    await app.prisma.deliverySlot.delete({ where: { id: request.params.id } });

    const response: ApiResponse<null> = { success: true, data: null };
    return response;
  });

  // GET /available — Customer: get available slots for a date
  app.get("/available", {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { storeId, date } = request.query as { storeId?: string; date?: string };

    if (!storeId) return reply.badRequest("storeId is required");
    if (!date) return reply.badRequest("date is required (YYYY-MM-DD)");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.badRequest("Invalid date format. Use YYYY-MM-DD");
    }

    // Stores run on India time, whatever zone the server is in
    const now = istNow();
    if (date < now.key || date > addDays(now.key, BOOKING_DAYS)) {
      return reply.badRequest("Date must be between today and 7 days from now");
    }

    const availableSlots = await slotsForDate(app.prisma, storeId, date);

    const response: ApiResponse<typeof availableSlots> = {
      success: true,
      data: availableSlots,
    };
    return response;
  });

  // GET /check — Customer: check if store has delivery slots + express availability
  app.get("/check", {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!storeId) return reply.badRequest("storeId is required");

    const [count, expressConfig] = await Promise.all([
      app.prisma.deliverySlot.count({
        where: { storeId, isActive: true },
      }),
      app.prisma.expressDeliveryConfig.findUnique({
        where: { storeId },
      }),
    ]);

    // Express availability logic
    let expressEnabled = true;
    let expressAvailable = true;
    let expressEtaMinutes: number | null = null;
    let expressReason: string | undefined;

    if (expressConfig) {
      expressEnabled = expressConfig.isEnabled;
      expressEtaMinutes = expressConfig.etaMinutes;

      if (!expressConfig.isEnabled) {
        expressAvailable = false;
      } else if (expressConfig.operatingStart && expressConfig.operatingEnd) {
        // Operating hours are India time, whatever zone the server runs in
        const currentMinutes = istNow().minutes;
        const [startH, startM] = expressConfig.operatingStart.split(":").map(Number);
        const [endH, endM] = expressConfig.operatingEnd.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
          expressAvailable = false;
          const formatTime = (h: number, m: number) => {
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
          };
          expressReason = `Outside operating hours (${formatTime(startH, startM)} - ${formatTime(endH, endM)})`;
        }
      }
    }

    const response: ApiResponse<{
      hasSlots: boolean;
      express: {
        enabled: boolean;
        available: boolean;
        etaMinutes: number | null;
        reason?: string;
      };
    }> = {
      success: true,
      data: {
        hasSlots: count > 0,
        express: {
          enabled: expressEnabled,
          available: expressAvailable,
          etaMinutes: expressEtaMinutes,
          ...(expressReason ? { reason: expressReason } : {}),
        },
      },
    };
    return response;
  });
}
