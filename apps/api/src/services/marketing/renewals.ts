import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { sendNotification } from "../notification.js";

const REMINDER_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

export async function notifyOwners(fcm: Messaging | null, prisma: PrismaClient, organizationId: string, title: string, body: string) {
  const owners = await prisma.user.findMany({
    where: { role: "ORG_ADMIN", userStores: { some: { store: { organizationId } } } },
    select: { id: true },
  });
  for (const { id } of owners) {
    await sendNotification(fcm, prisma, { userId: id, type: "GENERAL", title, body, data: { screen: "marketing-plan" } });
  }
}

/** Periods that just ended: when nothing follows, the org is back on Free (running promotions finish their run) */
export async function closeEndedPeriods(fcm: Messaging | null, prisma: PrismaClient) {
  const now = new Date();
  const ended = await prisma.orgPlanPeriod.findMany({ where: { endsAt: { lte: now }, closedAt: null }, include: { product: { select: { name: true } } } });
  for (const period of ended) {
    // Another instance may be closing the same period
    const { count } = await prisma.orgPlanPeriod.updateMany({ where: { id: period.id, closedAt: null }, data: { closedAt: now } });
    if (!count) continue;
    const next = await prisma.orgPlanPeriod.findFirst({ where: { organizationId: period.organizationId, startsAt: { lte: now }, endsAt: { gt: now } } });
    if (next) continue;
    await notifyOwners(fcm, prisma, period.organizationId,
      period.isTrial ? `Your free ${period.product.name} trial has ended` : `${period.product.name} plan has ended`,
      period.isTrial
        ? "Choose a plan to keep starting promotions. Promotions already running finish their run."
        : "You're on the Free plan now. Promotions already running finish their run; renew to start new ones.");
  }
}

/** One reminder three days before a plan runs out, unless another month is already paid for or it renews itself */
export async function sendRenewalReminders(fcm: Messaging | null, prisma: PrismaClient) {
  const now = new Date();
  const ending = await prisma.orgPlanPeriod.findMany({
    where: { endsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) }, reminderSentAt: null },
    include: { product: { select: { name: true } } },
  });
  for (const period of ending) {
    const [queued, renewing] = await Promise.all([
      prisma.orgPlanPeriod.count({ where: { organizationId: period.organizationId, startsAt: { gte: period.endsAt } } }),
      // A plan on auto-renew needs no reminder; Razorpay tells the customer before each debit
      prisma.marketingSubscription.count({ where: { organizationId: period.organizationId, status: { in: ["ACTIVE", "CREATED"] }, cancelAtPeriodEnd: false } }),
    ]);
    const { count } = await prisma.orgPlanPeriod.updateMany({ where: { id: period.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!count || queued || renewing) continue;
    const day = period.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
    await notifyOwners(fcm, prisma, period.organizationId, `Your ${period.product.name} plan ends on ${day}`, "Renew now to keep starting new promotions.");
  }
}
