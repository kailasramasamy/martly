import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { SETTLEMENT_HOUR_IST } from "@martly/shared/constants";
import type { Settlement } from "../../generated/prisma/client.js";
import { istWeekStart } from "../services/ledger/balance.js";
import { organizationsToSettle, raiseDueIfOverdue, runWeeklySettlement } from "../services/ledger/settlement.js";
import { claimOnce } from "../services/notify/once.js";
import { istDateKey } from "../services/ist-day.js";
import {
  alertLargeRefunds, notifyBankDetailsMissing, notifyDueRaised, notifySettlement, notifySettlementRunFinished,
} from "../services/notify/finance-alerts.js";

const INTERVAL_MS = 5 * 60 * 1000;

/** Settles every organization once a week (Monday 06:00 IST), raises dues for long-negative balances, and sweeps finance alerts */
async function settlementSchedulerPlugin(app: FastifyInstance) {
  async function weeklyRun(now: Date) {
    if (now.getTime() < istWeekStart(now).getTime() + SETTLEMENT_HOUR_IST * 60 * 60 * 1000) return;
    const created: Settlement[] = [];
    for (const organizationId of await organizationsToSettle(app.prisma, now)) {
      const settlement = await runWeeklySettlement(app.prisma, organizationId, now);
      if (!settlement) continue;
      created.push(settlement);
      await notifySettlement(app.fcm, app.prisma, settlement);
      const due = await raiseDueIfOverdue(app.prisma, organizationId);
      if (due) await notifyDueRaised(app.fcm, app.prisma, due);
    }
    await notifySettlementRunFinished(app.fcm, app.prisma, created.filter((s) => s.status === "APPROVED"));
  }

  /** Owners with a payout waiting on bank details hear about it at most once a day */
  async function remindMissingAccounts(now: Date) {
    const drafts = await app.prisma.settlement.findMany({ where: { status: "DRAFT", carriedIntoId: null } });
    const fresh = await claimOnce(app.prisma, drafts.map((s) => `stl-noacct:${s.organizationId}:${istDateKey(now)}`));
    for (const s of drafts.filter((d) => fresh.has(`stl-noacct:${d.organizationId}:${istDateKey(now)}`))) {
      await notifyBankDetailsMissing(app.fcm, app.prisma, s.organizationId, Number(s.net));
    }
  }

  async function run() {
    const now = new Date();
    await weeklyRun(now);
    await remindMissingAccounts(now);
    await alertLargeRefunds(app.fcm, app.prisma, now);
  }

  let interval: ReturnType<typeof setInterval> | undefined;

  app.addHook("onReady", async () => {
    interval = setInterval(() => {
      run().catch((err: unknown) => app.log.error(err, "Settlement scheduler run failed"));
    }, INTERVAL_MS);
    app.log.info("Settlement scheduler started (every 5 minutes)");
  });

  app.addHook("onClose", () => {
    if (interval) clearInterval(interval);
  });
}

export default fp(settlementSchedulerPlugin, { name: "settlement-scheduler" });
