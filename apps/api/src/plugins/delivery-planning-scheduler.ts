import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { istNow, istWeekday } from "../services/ist-day.js";
import { DEFAULT_DELIVERY_SETTINGS, deliverySettings } from "../services/delivery/settings.js";
import { planWave, waveTripWhere, wavePoolWhere, type Wave } from "../services/delivery/plan-wave.js";

const INTERVAL_MS = 60_000;

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Plans each auto-plan store's slots once their cutoff passes, and batches express orders as they're packed */
async function deliveryPlanningSchedulerPlugin(app: FastifyInstance) {
  /** A slot is planned once, at cutoff, if nothing has been planned for it yet; later orders wait for a manual re-plan */
  async function planDueSlots(storeId: string, now: { key: string; minutes: number }) {
    const slots = await app.prisma.deliverySlot.findMany({ where: { storeId, isActive: true, dayOfWeek: istWeekday(now.key) } });
    for (const slot of slots) {
      const due = now.minutes >= minutesOf(slot.startTime) - slot.cutoffMinutes && now.minutes < minutesOf(slot.endTime);
      if (!due) continue;
      const wave: Wave = { kind: "SLOT", slotId: slot.id, dateKey: now.key };
      const [trips, waiting] = await Promise.all([
        app.prisma.deliveryTrip.count({ where: waveTripWhere(storeId, wave) }),
        app.prisma.order.count({ where: wavePoolWhere(storeId, wave) }),
      ]);
      if (trips === 0 && waiting > 0) {
        const result = await planWave(app.prisma, storeId, wave);
        app.log.info(`Auto-planned slot ${slot.startTime}–${slot.endTime} at store ${storeId}: ${result.tripIds.length} trips, ${result.overflow} over capacity`);
      }
    }
  }

  /** Express orders go out in small batches: once enough are packed, or the oldest has waited long enough */
  async function batchExpress(storeId: string, batchSize: number, maxWaitMinutes: number) {
    const pool = await app.prisma.order.findMany({ where: wavePoolWhere(storeId, { kind: "EXPRESS" }), select: { updatedAt: true }, orderBy: { updatedAt: "asc" } });
    if (pool.length === 0) return;
    const waitedMinutes = (Date.now() - pool[0].updatedAt.getTime()) / 60_000;
    if (pool.length >= batchSize || waitedMinutes >= maxWaitMinutes) await planWave(app.prisma, storeId, { kind: "EXPRESS" }, { keepPlanned: true });
  }

  async function run() {
    const now = istNow();
    const stores = await app.prisma.store.findMany({ where: { status: "ACTIVE" }, select: { id: true, deliverySettings: { select: { autoPlan: true } } } });
    for (const store of stores) {
      if (!(store.deliverySettings?.autoPlan ?? DEFAULT_DELIVERY_SETTINGS.autoPlan)) continue;
      const settings = await deliverySettings(app.prisma, store.id);
      await planDueSlots(store.id, now);
      await batchExpress(store.id, settings.expressBatchSize, settings.expressMaxWaitMinutes);
    }
  }

  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(() => {
      run().catch((err: unknown) => app.log.error(err, "Delivery planning scheduler run failed"));
    }, INTERVAL_MS);
    app.log.info("Delivery planning scheduler started (every minute)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(deliveryPlanningSchedulerPlugin, { name: "delivery-planning-scheduler" });
