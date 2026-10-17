import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { sendNotification } from "../notification.js";
import { getEntitlements, slotBannerWhere } from "./entitlements.js";

const REMINDER_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

async function notifyOwners(fcm: Messaging | null, prisma: PrismaClient, organizationId: string, title: string, body: string) {
  const owners = await prisma.user.findMany({
    where: { role: "ORG_ADMIN", userStores: { some: { store: { organizationId } } } },
    select: { id: true },
  });
  for (const { id } of owners) {
    await sendNotification(fcm, prisma, { userId: id, type: "GENERAL", title, body, data: { screen: "marketing-plan" } });
  }
}

/** Keeps the oldest banners on and switches off the rest once the plan in force has fewer slots */
export async function switchOffExcessBanners(prisma: PrismaClient, organizationId: string) {
  const { bannerSlots } = await getEntitlements(prisma, organizationId);
  if (bannerSlots.total === null || bannerSlots.used <= bannerSlots.total) return 0;
  const active = await prisma.banner.findMany({ where: slotBannerWhere(organizationId), orderBy: { createdAt: "asc" }, select: { id: true } });
  const excess = active.slice(bannerSlots.total).map((b) => b.id);
  await prisma.banner.updateMany({ where: { id: { in: excess } }, data: { isActive: false } });
  return excess.length;
}

/** Periods that just ended: when nothing follows, the org is back on Free and banners beyond its slots go off */
export async function closeEndedPeriods(fcm: Messaging | null, prisma: PrismaClient) {
  const now = new Date();
  const ended = await prisma.orgPlanPeriod.findMany({ where: { endsAt: { lte: now }, closedAt: null }, include: { product: { select: { name: true } } } });
  for (const period of ended) {
    // Another instance may be closing the same period
    const { count } = await prisma.orgPlanPeriod.updateMany({ where: { id: period.id, closedAt: null }, data: { closedAt: now } });
    if (!count) continue;
    const next = await prisma.orgPlanPeriod.findFirst({ where: { organizationId: period.organizationId, startsAt: { lte: now }, endsAt: { gt: now } } });
    if (next) continue;
    const switchedOff = await switchOffExcessBanners(prisma, period.organizationId);
    await notifyOwners(fcm, prisma, period.organizationId, `${period.product.name} plan has ended`,
      switchedOff
        ? `You're on the Free plan now and ${switchedOff} banner${switchedOff === 1 ? " was" : "s were"} switched off. Renew to bring them back.`
        : "You're on the Free plan now. Renew to keep running promotions.");
  }
}

/** One reminder three days before a plan runs out, unless another month is already paid for */
export async function sendRenewalReminders(fcm: Messaging | null, prisma: PrismaClient) {
  const now = new Date();
  const ending = await prisma.orgPlanPeriod.findMany({
    where: { endsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) }, reminderSentAt: null },
    include: { product: { select: { name: true } } },
  });
  for (const period of ending) {
    const queued = await prisma.orgPlanPeriod.count({ where: { organizationId: period.organizationId, startsAt: { gte: period.endsAt } } });
    const { count } = await prisma.orgPlanPeriod.updateMany({ where: { id: period.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!count || queued) continue;
    const day = period.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
    await notifyOwners(fcm, prisma, period.organizationId, `Your ${period.product.name} plan ends on ${day}`, "Renew now to keep your banners and promotions running.");
  }
}
