import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { resolveAudience } from "../audience-resolver.js";
import { sendCampaignNotifications } from "../notification.js";
import { logStep } from "./draft.js";

// Customers hear about at most one promo per organisation per day
const PUSH_WINDOW_MS = 24 * 60 * 60 * 1000;

interface LaunchedPromo {
  id: string;
  organizationId: string;
  createdById: string;
  push: unknown;
  collectionId: string | null;
}

/** Tells the organisation's customers about a newly launched promo, unless one was pushed in the last day. */
export async function sendPromoPush(prisma: PrismaClient, fcm: Messaging | null, promo: LaunchedPromo, imageUrl: string | null) {
  const push = promo.push as { title: string; body: string } | null;
  if (!push || !promo.collectionId) return;
  const recent = await prisma.promo.findFirst({
    where: {
      organizationId: promo.organizationId, id: { not: promo.id }, campaignId: { not: null },
      campaign: { sentAt: { gte: new Date(Date.now() - PUSH_WINDOW_MS) } },
    },
    select: { id: true },
  });
  if (recent) return logStep(prisma, promo.id, "No push sent: another promo was pushed in the last 24 hours");
  const userIds = await resolveAudience(prisma, promo.organizationId, "ALL_CUSTOMERS");
  if (userIds.length === 0) return logStep(prisma, promo.id, "No push sent: this organisation has no customers yet");
  const data = { collectionId: promo.collectionId };
  const campaign = await prisma.notificationCampaign.create({
    data: {
      organizationId: promo.organizationId, title: push.title, body: push.body, type: "PROMOTIONAL", imageUrl, data,
      audienceType: "ALL_CUSTOMERS", status: "SENT", recipientCount: userIds.length, sentAt: new Date(), sentBy: promo.createdById,
    },
  });
  await prisma.promo.update({ where: { id: promo.id }, data: { campaignId: campaign.id } });
  await sendCampaignNotifications(fcm, prisma, campaign.id, userIds, {
    type: "PROMOTIONAL", title: push.title, body: push.body, imageUrl: imageUrl ?? undefined, data,
  });
  await logStep(prisma, promo.id, `Push sent to ${userIds.length} customers`);
}
