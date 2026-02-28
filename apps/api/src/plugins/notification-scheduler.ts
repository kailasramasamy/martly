import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { resolveAudience } from "../services/audience-resolver.js";
import { sendCampaignNotifications } from "../services/notification.js";

async function notificationSchedulerPlugin(app: FastifyInstance) {
  const INTERVAL_MS = 60_000; // 60 seconds

  async function processScheduledCampaigns() {
    try {
      const now = new Date();

      // Find campaigns that are SCHEDULED and past due
      const campaigns = await app.prisma.notificationCampaign.findMany({
        where: {
          status: "SCHEDULED",
          scheduledAt: { lte: now },
        },
      });

      for (const campaign of campaigns) {
        try {
          // Mark as SENDING
          await app.prisma.notificationCampaign.update({
            where: { id: campaign.id },
            data: { status: "SENDING" },
          });

          // Resolve audience
          const userIds = await resolveAudience(
            app.prisma,
            campaign.organizationId,
            campaign.audienceType,
            campaign.audienceConfig as any,
          );

          // Send notifications
          await sendCampaignNotifications(app.fcm, app.prisma, campaign.id, userIds, {
            type: campaign.type,
            title: campaign.title,
            body: campaign.body,
            imageUrl: campaign.imageUrl ?? undefined,
            data: campaign.data as Record<string, unknown> | undefined,
          });

          // Mark as SENT
          await app.prisma.notificationCampaign.update({
            where: { id: campaign.id },
            data: {
              status: "SENT",
              recipientCount: userIds.length,
              sentAt: new Date(),
            },
          });

          app.log.info(`Scheduled campaign ${campaign.id} sent to ${userIds.length} users`);
        } catch (err) {
          app.log.error(err, `Failed to process scheduled campaign ${campaign.id}`);
          await app.prisma.notificationCampaign.update({
            where: { id: campaign.id },
            data: { status: "FAILED" },
          });
        }
      }
    } catch (err) {
      app.log.error(err, "Error processing scheduled campaigns");
    }
  }

  let intervalId: ReturnType<typeof setInterval>;

  app.addHook("onReady", () => {
    intervalId = setInterval(processScheduledCampaigns, INTERVAL_MS);
    app.log.info("Notification scheduler started (60s interval)");
  });

  app.addHook("onClose", () => {
    if (intervalId) clearInterval(intervalId);
  });
}

export default fp(notificationSchedulerPlugin, { name: "notification-scheduler" });
