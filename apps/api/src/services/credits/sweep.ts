import type { FastifyInstance } from "fastify";
import { CREDIT_REMINDER_DAYS } from "@martly/shared/constants";
import { sendNotification } from "../notification.js";
import { formatINR } from "../notify/copy.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Marks unused credit past its expiry and reminds customers whose credit runs out within CREDIT_REMINDER_DAYS */
export async function runCreditSweep(app: FastifyInstance) {
  const now = new Date();
  const expired = await app.prisma.creditGrant.updateMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });

  const due = await app.prisma.creditGrant.findMany({
    where: { status: "ACTIVE", reminderSentAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + CREDIT_REMINDER_DAYS * DAY_MS) } },
    include: { campaign: { select: { minOrderAmount: true, store: { select: { name: true } } } } },
  });
  for (const grant of due) {
    // Claim the reminder first so an overlapping run can't send it twice
    const { count } = await app.prisma.creditGrant.updateMany({ where: { id: grant.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (count === 0) continue;
    const days = Math.max(1, Math.ceil((grant.expiresAt.getTime() - now.getTime()) / DAY_MS));
    const where = grant.campaign.store ? ` at ${grant.campaign.store.name}` : "";
    await sendNotification(app.fcm, app.prisma, {
      userId: grant.userId,
      type: "PROMOTIONAL",
      title: `Your ${formatINR(Number(grant.amount))} expires in ${days === 1 ? "a day" : `${days} days`}`,
      body: `Use it${where} on an order above ${formatINR(Number(grant.campaign.minOrderAmount))} before it's gone.`,
      data: { screen: "wallet" },
    });
  }
  if (expired.count > 0 || due.length > 0) app.log.info(`Credit sweep: ${expired.count} expired, ${due.length} reminded`);
}
