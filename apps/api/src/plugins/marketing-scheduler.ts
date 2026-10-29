import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { closeEndedPeriods, sendRenewalReminders } from "../services/marketing/renewals.js";
import { advanceCampaigns } from "../services/brand-campaigns/go-live.js";

const INTERVAL_MS = 5 * 60_000;

/** Plan expiries, renewal reminders and brand campaign dates; every step claims its rows, so several instances can run it */
async function marketingSchedulerPlugin(app: FastifyInstance) {
  async function run() {
    await closeEndedPeriods(app.fcm, app.prisma);
    await sendRenewalReminders(app.fcm, app.prisma);
    await advanceCampaigns({ prisma: app.prisma, fcm: app.fcm, log: app.log });
  }

  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("marketing", run), INTERVAL_MS);
    app.log.info("Marketing scheduler started (every 5 min)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(marketingSchedulerPlugin, { name: "marketing-scheduler" });
