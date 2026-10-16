import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { bulkSlotRosterSchema, deliverySettingsSchema, planWaveSchema, slotRosterOverrideSchema, slotRosterSchema } from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { storeRiders } from "../../services/permissions.js";
import { istDay } from "../../services/ist-day.js";
import { deliveryPlan } from "../../services/delivery/plan-view.js";
import { planWave, type Wave } from "../../services/delivery/plan-wave.js";
import { dateColumn, deliverySettings } from "../../services/delivery/settings.js";

const viewers = [authenticate, requirePermission(Permission.ORDERS_VIEW, Permission.ORDERS_DISPATCH, Permission.DELIVERY_CONFIG)];
const dispatchers = [authenticate, requirePermission(Permission.ORDERS_DISPATCH)];
// Trip sizes, rider load and slot rosters are day-to-day fleet calls: delivery setup or rider management both qualify
const fleetEditors = [authenticate, requirePermission(Permission.DELIVERY_CONFIG, Permission.RIDERS_MANAGE)];

/** Slots, rosters, auto-planned trips and fleet settings: how a store turns orders into rider trips */
export async function deliveryPlanRoutes(app: FastifyInstance) {
  async function storeAccess(request: FastifyRequest, reply: FastifyReply, storeId: string | undefined) {
    if (!storeId) return void reply.badRequest("storeId is required");
    if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return void reply.forbidden("Access denied");
    return storeId;
  }

  /** Loads a slot the caller's store access covers, plus that store's riders */
  async function ownSlot(request: FastifyRequest<{ Params: { slotId: string } }>, reply: FastifyReply) {
    const slot = await app.prisma.deliverySlot.findUnique({ where: { id: request.params.slotId } });
    if (!slot) return void reply.notFound("Slot not found");
    if (!(await storeAccess(request, reply, slot.storeId))) return;
    const riders = new Set((await storeRiders(app.prisma, slot.storeId)).map((r) => r.id));
    return { slot, riders };
  }

  app.get("/", { preHandler: viewers }, async (request, reply) => {
    const { storeId, date } = request.query as { storeId?: string; date?: string };
    if (!(await storeAccess(request, reply, storeId))) return;
    const data = await deliveryPlan(app.prisma, storeId as string, date);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.post("/plan", { preHandler: dispatchers }, async (request, reply) => {
    const body = planWaveSchema.parse(request.body);
    if (!(await storeAccess(request, reply, body.storeId))) return;
    let wave: Wave = { kind: "EXPRESS" };
    if (body.slotId) {
      const slot = await app.prisma.deliverySlot.findFirst({ where: { id: body.slotId, storeId: body.storeId } });
      if (!slot) return reply.badRequest("Slot not found in this store");
      wave = { kind: "SLOT", slotId: slot.id, dateKey: istDay(body.date).key };
    }
    const result = await planWave(app.prisma, body.storeId, wave);
    const data = { ...result, plan: await deliveryPlan(app.prisma, body.storeId, body.date) };
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.get("/settings", { preHandler: viewers }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!(await storeAccess(request, reply, storeId))) return;
    const data = await deliverySettings(app.prisma, storeId as string);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.put("/settings", { preHandler: fleetEditors }, async (request, reply) => {
    const { storeId, ...settings } = deliverySettingsSchema.parse(request.body);
    if (!(await storeAccess(request, reply, storeId))) return;
    await app.prisma.storeDeliverySettings.upsert({ where: { storeId }, create: { storeId, ...settings }, update: settings });
    const data = await deliverySettings(app.prisma, storeId);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // Every active slot of the week with its weekly riders, for the roster screen
  app.get("/roster", { preHandler: viewers }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    if (!(await storeAccess(request, reply, storeId))) return;
    const [slots, riders] = await Promise.all([
      app.prisma.deliverySlot.findMany({
        where: { storeId, isActive: true },
        orderBy: [{ startTime: "asc" }, { dayOfWeek: "asc" }],
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, cutoffMinutes: true, maxOrders: true, riders: { select: { riderId: true } } },
      }),
      storeRiders(app.prisma, storeId as string),
    ]);
    const data = { riders, slots: slots.map(({ riders: r, ...s }) => ({ ...s, riderIds: r.map((x) => x.riderId) })) };
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // The same weekly riders on several slots in one save
  app.put("/roster", { preHandler: fleetEditors }, async (request, reply) => {
    const { storeId, slotIds, riderIds } = bulkSlotRosterSchema.parse(request.body);
    if (!(await storeAccess(request, reply, storeId))) return;
    const slots = await app.prisma.deliverySlot.count({ where: { id: { in: slotIds }, storeId } });
    if (slots !== slotIds.length) return reply.badRequest("Every slot must belong to this store");
    const riders = new Set((await storeRiders(app.prisma, storeId)).map((r) => r.id));
    if (riderIds.some((id) => !riders.has(id))) return reply.badRequest("Every rider must work at this store");
    await app.prisma.$transaction([
      app.prisma.slotRider.deleteMany({ where: { slotId: { in: slotIds }, riderId: { notIn: riderIds } } }),
      ...slotIds.flatMap((slotId) => riderIds.map((riderId) => app.prisma.slotRider.upsert({
        where: { slotId_riderId: { slotId, riderId } }, create: { slotId, riderId }, update: {},
      }))),
    ]);
    return { success: true, data: { slotIds, riderIds } } satisfies ApiResponse<{ slotIds: string[]; riderIds: string[] }>;
  });

  app.put<{ Params: { slotId: string } }>("/slots/:slotId/roster", { preHandler: fleetEditors }, async (request, reply) => {
    const { riderIds } = slotRosterSchema.parse(request.body);
    const owned = await ownSlot(request, reply);
    if (!owned) return;
    if (riderIds.some((id) => !owned.riders.has(id))) return reply.badRequest("Every rider must work at this store");
    await app.prisma.$transaction([
      app.prisma.slotRider.deleteMany({ where: { slotId: owned.slot.id, riderId: { notIn: riderIds } } }),
      ...riderIds.map((riderId) => app.prisma.slotRider.upsert({
        where: { slotId_riderId: { slotId: owned.slot.id, riderId } }, create: { slotId: owned.slot.id, riderId }, update: {},
      })),
    ]);
    return { success: true, data: { riderIds } } satisfies ApiResponse<{ riderIds: string[] }>;
  });

  app.put<{ Params: { slotId: string } }>("/slots/:slotId/roster/override", { preHandler: fleetEditors }, async (request, reply) => {
    const body = slotRosterOverrideSchema.parse(request.body);
    const owned = await ownSlot(request, reply);
    if (!owned) return;
    if (!owned.riders.has(body.riderId)) return reply.badRequest("This rider doesn't work at this store");
    const key = { slotId: owned.slot.id, riderId: body.riderId, date: dateColumn(body.date) };
    await app.prisma.slotRiderOverride.upsert({ where: { slotId_riderId_date: key }, create: { ...key, working: body.working }, update: { working: body.working } });
    return { success: true, data: body } satisfies ApiResponse<typeof body>;
  });
}
