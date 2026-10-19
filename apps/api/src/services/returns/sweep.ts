import type { FastifyInstance } from "fastify";
import { RETURN_COLLECT_DAYS, RETURN_EXPIRY_DAYS } from "@martly/shared/constants";
import { notifyReturnUpdate } from "../notify/return-alerts.js";
import { loadReturn, settleReturn } from "./settle.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/** No order came within the collection window: ask the customer to drop the item at the store */
async function moveUncollectedToStore(app: FastifyInstance) {
  const stale = await app.prisma.returnRequest.findMany({
    where: { status: "IN_PROGRESS", method: "NEXT_ORDER", receivedAt: null, resolvedAt: { lt: daysAgo(RETURN_COLLECT_DAYS) } },
  });
  for (const rr of stale) {
    const moved = await app.prisma.returnRequest.updateMany({ where: { id: rr.id, method: "NEXT_ORDER", receivedAt: null }, data: { method: "AT_STORE" } });
    if (moved.count) await notifyReturnUpdate(app.fcm, app.prisma, { ...rr, method: "AT_STORE" }, { kind: "MOVED_TO_STORE" });
  }
}

/** The item never came back: close the return without a refund */
async function expireUnreturned(app: FastifyInstance) {
  const stale = await app.prisma.returnRequest.findMany({
    where: { status: "IN_PROGRESS", method: { in: ["NEXT_ORDER", "AT_STORE"] }, receivedAt: null, resolvedAt: { lt: daysAgo(RETURN_EXPIRY_DAYS) } },
  });
  for (const rr of stale) {
    const expired = await app.prisma.returnRequest.updateMany({ where: { id: rr.id, status: "IN_PROGRESS", receivedAt: null }, data: { status: "EXPIRED" } });
    if (expired.count) await notifyReturnUpdate(app.fcm, app.prisma, rr, { kind: "EXPIRED" });
  }
}

/** A replacement that never rode on an order turns into a wallet refund */
async function refundUnsentReplacements(app: FastifyInstance) {
  const stale = await app.prisma.returnRequest.findMany({
    where: {
      status: "IN_PROGRESS", remedy: "REPLACE", resolvedAt: { lt: daysAgo(RETURN_COLLECT_DAYS) },
      replacementItems: { none: { order: { status: { not: "CANCELLED" } } } },
    },
    select: { id: true },
  });
  for (const { id } of stale) await replaceWithRefund(app, id);
}

export async function replaceWithRefund(app: FastifyInstance, id: string) {
  const result = await app.prisma.$transaction(async (tx) => {
    const switched = await tx.returnRequest.updateMany({ where: { id, status: "IN_PROGRESS", remedy: "REPLACE" }, data: { remedy: "REFUND" } });
    if (!switched.count) return null;
    const rr = (await loadReturn(tx, id))!;
    return { rr, outcome: await settleReturn(tx, rr) };
  });
  if (result?.outcome.refunded != null) {
    await notifyReturnUpdate(app.fcm, app.prisma, result.rr, { kind: "REPLACEMENT_REFUNDED", refunded: result.outcome.refunded });
  }
}

export async function runReturnSweep(app: FastifyInstance) {
  await refundUnsentReplacements(app);
  await moveUncollectedToStore(app);
  await expireUnreturned(app);
}
