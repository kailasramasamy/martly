import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { sendNotification } from "../services/notification.js";
import { alertOnce } from "../services/notify/once.js";
import { formatISTDate } from "../services/notify/copy.js";

const INTERVAL_MS = 60 * 60 * 1000;
const SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Warns members three days before their plan ends, then expires it and says so */
async function membershipSchedulerPlugin(app: FastifyInstance) {
  async function notifyEndingSoon(now: Date) {
    const ending = await app.prisma.userMembership.findMany({
      where: { status: "ACTIVE", endDate: { gt: now, lte: new Date(now.getTime() + SOON_WINDOW_MS) } },
      include: { plan: { select: { name: true } } },
    });
    for (const m of ending) {
      if (!(await alertOnce(app.prisma, `mship:${m.id}:soon`))) continue;
      await sendNotification(app.fcm, app.prisma, {
        userId: m.userId,
        type: "MEMBERSHIP",
        title: "Membership ending soon",
        body: `Your ${m.plan.name} membership ends on ${formatISTDate(m.endDate)}. Renew to keep your benefits.`,
        data: { screen: "membership" },
      });
    }
  }

  async function expireEnded(now: Date) {
    const ended = await app.prisma.userMembership.findMany({
      where: { status: "ACTIVE", endDate: { lt: now } },
      include: { plan: { select: { name: true } } },
    });
    for (const m of ended) {
      await app.prisma.userMembership.update({ where: { id: m.id }, data: { status: "EXPIRED" } });
      // Long-lapsed plans (e.g. on first deploy) are expired quietly; only a recent end is news
      if (now.getTime() - m.endDate.getTime() > SOON_WINDOW_MS) continue;
      if (!(await alertOnce(app.prisma, `mship:${m.id}:ended`))) continue;
      await sendNotification(app.fcm, app.prisma, {
        userId: m.userId,
        type: "MEMBERSHIP",
        title: "Your membership has ended",
        body: `Your ${m.plan.name} membership has ended. Rejoin any time to get your benefits back.`,
        data: { screen: "membership" },
      });
    }
  }

  async function run() {
    const now = new Date();
    await notifyEndingSoon(now);
    await expireEnded(now);
  }

  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(app.scheduledJob("membership", run), INTERVAL_MS);
    app.log.info("Membership scheduler started (hourly)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(membershipSchedulerPlugin, { name: "membership-scheduler" });
