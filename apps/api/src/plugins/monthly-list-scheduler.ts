import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { sendMonthlyListReminders } from "../services/monthly-list/reminders.js";
import { msUntilISTHour } from "../utils/timezone.js";

// Monthly lists are reminded in the morning of the shopper's day, so the list is there before they shop
const RUN_HOUR_IST = 7;
// Production catches up a run missed during a restart; each list is reminded once a month at most
const STARTUP_DELAY_MS = 5 * 60_000;

async function monthlyListSchedulerPlugin(app: FastifyInstance) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const log = { info: (msg: string) => app.log.info(msg), error: (err: unknown, msg: string) => app.log.error(err, msg) };
  const run = () => sendMonthlyListReminders(app.fcm, app.prisma, log).catch((err: unknown) => app.log.error(err, "Monthly list reminders failed"));

  function scheduleDaily() {
    timer = setTimeout(async () => {
      await run();
      scheduleDaily();
    }, msUntilISTHour(RUN_HOUR_IST));
  }

  app.addHook("onReady", () => {
    scheduleDaily();
    if (process.env.NODE_ENV === "production") setTimeout(run, STARTUP_DELAY_MS).unref();
    app.log.info(`Monthly list scheduler started (daily at ${RUN_HOUR_IST}:00 IST)`);
  });
  app.addHook("onClose", () => {
    if (timer) clearTimeout(timer);
  });
}

export default fp(monthlyListSchedulerPlugin, { name: "monthly-list-scheduler" });
