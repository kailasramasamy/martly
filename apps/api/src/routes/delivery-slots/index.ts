import type { FastifyInstance } from "fastify";
import { createDeliverySlotSchema, updateDeliverySlotSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function deliverySlotRoutes(app: FastifyInstance) {
  // GET / — List slots for a store (admin)
  app.get("/", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")],
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
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
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
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
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

    const response: ApiResponse<typeof slot> = { success: true, data: slot };
    return response;
  });

  // DELETE /:id — Delete a slot
  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")],
  }, async (request, reply) => {
    const existing = await app.prisma.deliverySlot.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Delivery slot not found");

    if (!(await verifyStoreOrgAccess(request, app.prisma, existing.storeId))) {
      return reply.forbidden("Access denied");
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

    const parsedDate = new Date(date + "T00:00:00");
    if (isNaN(parsedDate.getTime())) {
      return reply.badRequest("Invalid date format. Use YYYY-MM-DD");
    }

    // Check date is within 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);

    if (parsedDate < today || parsedDate > maxDate) {
      return reply.badRequest("Date must be between today and 7 days from now");
    }

    const dayOfWeek = parsedDate.getDay();
    const isToday = parsedDate.toDateString() === new Date().toDateString();

    // Find active slots for this day
    const slots = await app.prisma.deliverySlot.findMany({
      where: {
        storeId,
        dayOfWeek,
        isActive: true,
      },
      orderBy: { startTime: "asc" },
    });

    // Count booked orders per slot for this date
    const startOfDay = new Date(date + "T00:00:00");
    const endOfDay = new Date(date + "T23:59:59.999");

    const slotIds = slots.map((s) => s.id);
    const bookingCounts = slotIds.length > 0
      ? await app.prisma.order.groupBy({
          by: ["deliverySlotId"],
          where: {
            deliverySlotId: { in: slotIds },
            scheduledDate: { gte: startOfDay, lte: endOfDay },
            status: { not: "CANCELLED" },
          },
          _count: true,
        })
      : [];

    const countMap = new Map(bookingCounts.map((b) => [b.deliverySlotId, b._count]));

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const availableSlots = slots
      .map((slot) => {
        const booked = countMap.get(slot.id) ?? 0;
        const available = slot.maxOrders - booked;

        // Check cutoff: if today, slot start time minus cutoff must be in the future
        if (isToday) {
          const [h, m] = slot.startTime.split(":").map(Number);
          const slotStartMinutes = h * 60 + m;
          if (currentMinutes >= slotStartMinutes - slot.cutoffMinutes) {
            return null; // past cutoff
          }
        }

        return {
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxOrders: slot.maxOrders,
          available,
          full: available <= 0,
        };
      })
      .filter(Boolean);

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
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
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
