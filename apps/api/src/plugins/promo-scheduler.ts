import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { failStaleDrafts, logStep } from "../services/promo/draft.js";
import { announcePromo } from "../services/notify/marketing-alerts.js";
import { endPromo, launchPromo, PromoStateError } from "../services/promo/lifecycle.js";

// Discounts expire on their own at endsAt; this only restores what promos overwrote and takes banners down
const INTERVAL_MS = 5 * 60_000;
const PROMO_REF = { id: true, organizationId: true, createdById: true, brandCampaignId: true } as const;

async function promoSchedulerPlugin(app: FastifyInstance) {
  async function endExpiredPromos() {
    const expired = await app.prisma.promo.findMany({ where: { status: "LIVE", endsAt: { lte: new Date() } }, select: PROMO_REF });
    for (const promo of expired) {
      // Another instance (or an admin's End now) got there first
      const ended = await endPromo(app.prisma, promo.id, false).then(() => true, (err: unknown) => {
        if (!(err instanceof PromoStateError)) app.log.error(err, `Failed to end promo ${promo.id}`);
        return false;
      });
      if (ended) await announcePromo(app.fcm, app.prisma, promo, "ended");
    }
  }

  // Ready promotions scheduled to start; launching claims READY → LIVE, so two instances can't both launch one
  async function launchDuePromos() {
    const due = await app.prisma.promo.findMany({ where: { status: "READY", launchAt: { lte: new Date() } }, select: PROMO_REF });
    for (const promo of due) {
      const { id } = promo;
      const launched = await launchPromo({ prisma: app.prisma, fcm: app.fcm, log: app.log }, id).then(() => true, async (err: unknown) => {
        if (err instanceof PromoStateError) return false;
        app.log.error(err, `Failed to launch promo ${id}`);
        // Don't retry every run; the owner sees the reason and can launch it by hand
        await app.prisma.promo.update({ where: { id }, data: { launchAt: null } });
        await logStep(app.prisma, id, `Scheduled launch failed: ${(err as Error).message}`);
        await announcePromo(app.fcm, app.prisma, promo, "launch-failed", (err as Error).message);
        return false;
      });
      if (launched) await announcePromo(app.fcm, app.prisma, promo, "live");
    }
  }

  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    // Drafts run in-process, so any still drafting from before this start were cut off
    await failStaleDrafts(app.prisma, app.fcm);
    interval = setInterval(() => {
      launchDuePromos()
        .then(endExpiredPromos)
        .catch((err: unknown) => app.log.error(err, "Promo scheduler run failed"));
    }, INTERVAL_MS);
    app.log.info("Promo scheduler started (every 5 min)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(promoSchedulerPlugin, { name: "promo-scheduler" });
