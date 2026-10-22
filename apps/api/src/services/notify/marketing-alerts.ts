import type { Messaging } from "firebase-admin/messaging";
import type { BrandCampaign, PrismaClient } from "../../../generated/prisma/client.js";
import { resolveAudience } from "../audience-resolver.js";
import { sendCampaignNotifications, sendNotification } from "../notification.js";
import { formatISTDate, plural } from "./copy.js";
import { notifyOrgStaff } from "./staff.js";
import { alertOnce, promotionalAllowed } from "./once.js";

const SEND_BATCH = 50;
// Only collections that just went live are announced, so a deploy never re-announces old ones
const LIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

interface PromoRef {
  id: string;
  organizationId: string;
  createdById: string;
  brandCampaignId?: string | null;
}

type PromoEvent = "ready" | "draft-failed" | "live" | "launch-failed" | "ended";

const PROMO_COPY: Record<PromoEvent, (detail: string) => { title: string; body: string }> = {
  ready: (title) => ({ title: "Promotion ready to review", body: title }),
  "draft-failed": (reason) => ({ title: "Promotion draft failed", body: reason }),
  live: () => ({ title: "Promotion is live", body: "Your promotion has started." }),
  "launch-failed": (reason) => ({ title: "Promotion failed to launch", body: `${reason}. Launch it manually.` }),
  ended: () => ({ title: "Promotion ended", body: "Prices are back to normal." }),
};

/** Tells whoever created a promotion what happened to it; brand-campaign promos have no organisation creator to tell */
export async function notifyPromoCreator(fcm: Messaging | null, prisma: PrismaClient, promo: PromoRef, event: PromoEvent, detail = "") {
  if (promo.brandCampaignId) return;
  const { title, body } = PROMO_COPY[event](detail);
  await notifyOrgStaff(
    fcm, prisma, promo.organizationId,
    { userIds: [promo.createdById], escalation: event === "launch-failed" },
    { type: "STAFF_MARKETING", title, body, data: { screen: "promo", promoId: promo.id } },
  );
}

/** Same as notifyPromoCreator for events a scheduler re-detects: each fires once per promotion */
export async function announcePromo(fcm: Messaging | null, prisma: PrismaClient, promo: PromoRef, event: PromoEvent, detail = "") {
  if (await alertOnce(prisma, `promo-${event}:${promo.id}`)) await notifyPromoCreator(fcm, prisma, promo, event, detail);
}

export async function notifyCampaignOutcome(
  fcm: Messaging | null,
  prisma: PrismaClient,
  campaign: { id: string; organizationId: string; sentBy: string },
  recipients: number | null,
) {
  const sent = recipients !== null;
  await notifyOrgStaff(
    fcm, prisma, campaign.organizationId,
    { userIds: [campaign.sentBy], escalation: !sent },
    {
      type: "STAFF_MARKETING",
      title: sent ? `Campaign sent to ${plural(recipients, "customer")}` : "Campaign failed to send",
      body: sent ? "Your scheduled campaign went out." : "Your scheduled campaign could not be sent. Check it and try again.",
      data: { screen: "campaign", campaignId: campaign.id },
    },
  );
}

async function brandName(prisma: PrismaClient, brandId: string) {
  return (await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { name: true } })).name;
}

/** Marketing managers of each participating organisation hear about a brand campaign before it starts */
export async function notifyCampaignScheduled(fcm: Messaging | null, prisma: PrismaClient, campaign: BrandCampaign, organizationIds: string[], rescheduled = false) {
  const brand = await brandName(prisma, campaign.brandId);
  await Promise.all(organizationIds.map((organizationId) => notifyOrgStaff(
    fcm, prisma, organizationId, { permissions: ["MARKETING_MANAGE"] },
    {
      type: "STAFF_MARKETING",
      title: `${brand} campaign ${rescheduled ? "now starts" : "starts"} ${formatISTDate(campaign.startsAt)} in your stores`,
      body: campaign.placement ? "Its ads and offers will show to your shoppers from that day." : `${brand} products will show as Featured in search and aisles from that day.`,
      data: { screen: "brand-ads" },
    },
  )));
}

/** Martly's team approves brand creatives on the web, so this alert opens no screen */
export async function notifyCampaignInReview(fcm: Messaging | null, prisma: PrismaClient, campaign: Pick<BrandCampaign, "brandId" | "title">) {
  const [brand, admins] = await Promise.all([
    brandName(prisma, campaign.brandId),
    prisma.user.findMany({ where: { role: "SUPER_ADMIN", deletedAt: null }, select: { id: true } }),
  ]);
  await Promise.all(admins.map(({ id }) => sendNotification(fcm, prisma, {
    userId: id, type: "STAFF_MARKETING", title: `Brand campaign needs approval · ${brand}`, body: campaign.title, data: {}, sound: true,
  })));
}

/** Pushes the brand's campaign to each participating organisation's customers who haven't had a promotional push today */
export async function pushBrandCampaignLive(fcm: Messaging | null, prisma: PrismaClient, campaign: BrandCampaign, organizationId: string) {
  const [brand, promo] = await Promise.all([
    brandName(prisma, campaign.brandId),
    prisma.promo.findFirst({ where: { brandCampaignId: campaign.id, organizationId }, select: { collectionId: true } }),
  ]);
  const audience = await resolveAudience(prisma, organizationId, "ALL_CUSTOMERS");
  const userIds = await promotionalAllowed(prisma, audience);
  if (userIds.length === 0) return;
  const data = promo?.collectionId ? { screen: "collection", collectionId: promo.collectionId } : { screen: "brand", brandId: campaign.brandId };
  const push = { type: "PROMOTIONAL" as const, title: `${brand}: ${campaign.title}`, body: campaign.subtitle ?? `Shop ${brand} now.`, imageUrl: campaign.imageUrl ?? undefined, data };
  const row = await prisma.notificationCampaign.create({
    data: {
      organizationId, title: push.title, body: push.body, type: "PROMOTIONAL", imageUrl: campaign.imageUrl, data,
      audienceType: "ALL_CUSTOMERS", status: "SENT", recipientCount: userIds.length, sentAt: new Date(), sentBy: campaign.createdById,
    },
  });
  await sendCampaignNotifications(fcm, prisma, row.id, userIds, push);
}

/** Festival and seasonal collections that went live in the last two days are announced once each */
export async function announceLiveCollections(fcm: Messaging | null, prisma: PrismaClient) {
  const now = new Date();
  const live = await prisma.collection.findMany({
    where: {
      source: "AGENT", festivalEventId: { not: null }, organizationId: { not: null }, isActive: true,
      startsAt: { lte: now, gte: new Date(now.getTime() - LIVE_WINDOW_MS) }, OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { id: true, organizationId: true, title: true, subtitle: true },
  });
  for (const collection of live) {
    if (!(await alertOnce(prisma, `collection-live:${collection.id}`))) continue;
    const audience = await resolveAudience(prisma, collection.organizationId!, "ALL_CUSTOMERS");
    const userIds = await promotionalAllowed(prisma, audience);
    const alert = {
      type: "PROMOTIONAL" as const, title: collection.title, body: collection.subtitle ?? "Fresh picks for the season are in.",
      data: { screen: "collection", collectionId: collection.id },
    };
    for (let i = 0; i < userIds.length; i += SEND_BATCH) {
      await Promise.all(userIds.slice(i, i + SEND_BATCH).map((userId) => sendNotification(fcm, prisma, { userId, ...alert })));
    }
  }
}
