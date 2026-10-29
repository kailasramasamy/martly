import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { NotificationCampaign } from "../../generated/prisma/client.js";
import { resolveAudience } from "../services/audience-resolver.js";
import { sendCampaignNotifications } from "../services/notification.js";
import { notifyCampaignOutcome } from "../services/notify/marketing-alerts.js";

const INTERVAL_MS = 60_000;
// A sender touches its campaign after every batch of in-app rows, so one this quiet has died mid-send
const STALE_SENDING_MS = 15 * 60_000;

async function notificationSchedulerPlugin(app: FastifyInstance) {
  /** A resumed campaign goes only to the audience that has no row for it yet, so nobody gets it twice */
  async function deliver(campaign: NotificationCampaign, resumed: boolean) {
    const audience = await resolveAudience(app.prisma, campaign.organizationId, campaign.audienceType, campaign.audienceConfig as Parameters<typeof resolveAudience>[3]);
    const reached = resumed
      ? new Set((await app.prisma.notification.findMany({ where: { campaignId: campaign.id }, select: { userId: true }, distinct: ["userId"] })).map((n) => n.userId))
      : new Set<string>();
    const userIds = audience.filter((id) => !reached.has(id));
    await sendCampaignNotifications(app.fcm, app.prisma, campaign.id, userIds, {
      type: campaign.type,
      title: campaign.title,
      body: campaign.body,
      imageUrl: campaign.imageUrl ?? undefined,
      data: campaign.data as Record<string, unknown> | undefined,
    });
    const recipientCount = reached.size + userIds.length;
    await app.prisma.notificationCampaign.update({ where: { id: campaign.id }, data: { status: "SENT", recipientCount, sentAt: new Date() } });
    app.log.info(`${resumed ? "Resumed" : "Scheduled"} campaign ${campaign.id} sent to ${recipientCount} users`);
    await notifyCampaignOutcome(app.fcm, app.prisma, campaign, recipientCount);
  }

  async function send(campaign: NotificationCampaign, resumed: boolean) {
    await deliver(campaign, resumed).catch(async (err: unknown) => {
      app.log.error(err, `Failed to process scheduled campaign ${campaign.id}`);
      await app.prisma.notificationCampaign.update({ where: { id: campaign.id }, data: { status: "FAILED" } });
      await notifyCampaignOutcome(app.fcm, app.prisma, campaign, null);
    });
  }

  /** Due campaigns are claimed SCHEDULED → SENDING, and stale sends by their last touch, so each is taken once */
  async function processCampaigns() {
    const now = new Date();
    const due = await app.prisma.notificationCampaign.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } } });
    for (const campaign of due) {
      const { count } = await app.prisma.notificationCampaign.updateMany({ where: { id: campaign.id, status: "SCHEDULED" }, data: { status: "SENDING" } });
      if (count === 1) await send(campaign, false);
    }
    const stale = await app.prisma.notificationCampaign.findMany({
      where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) } },
    });
    for (const campaign of stale) {
      const { count } = await app.prisma.notificationCampaign.updateMany({
        where: { id: campaign.id, status: "SENDING", updatedAt: campaign.updatedAt },
        data: { updatedAt: new Date() },
      });
      if (count === 1) await send(campaign, true);
    }
  }

  let intervalId: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", () => {
    intervalId = setInterval(app.scheduledJob("notification-campaigns", processCampaigns), INTERVAL_MS);
    app.log.info("Notification scheduler started (60s interval)");
  });

  app.addHook("onClose", () => {
    if (intervalId) clearInterval(intervalId);
  });
}

export default fp(notificationSchedulerPlugin, { name: "notification-scheduler" });
