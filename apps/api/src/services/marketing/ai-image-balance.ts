import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

type Db = PrismaClient | Prisma.TransactionClient;

/** The month's plan images used and left, and bought pack images (which never expire) */
export async function aiImageBalance(db: Db, organizationId: string, window: { start: Date; end: Date }, total: number) {
  const [planMoves, packs] = await Promise.all([
    db.aiImageCreditEntry.aggregate({ where: { organizationId, fromPlan: true, createdAt: { gte: window.start, lt: window.end } }, _sum: { delta: true } }),
    db.aiImageCreditEntry.aggregate({ where: { organizationId, fromPlan: false }, _sum: { delta: true } }),
  ]);
  const used = Math.max(0, -(planMoves._sum.delta ?? 0));
  const planLeft = Math.max(0, total - used);
  const packBalance = Math.max(0, packs._sum.delta ?? 0);
  return { used, total, planLeft, packBalance, left: planLeft + packBalance, resetsAt: window.end };
}
