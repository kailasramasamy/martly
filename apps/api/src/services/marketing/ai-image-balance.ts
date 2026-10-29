import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

type Db = PrismaClient | Prisma.TransactionClient;

/** The month's banners used and left under the hidden per-organisation cap */
export async function aiImageBalance(db: Db, organizationId: string, window: { start: Date; end: Date }, total: number) {
  const moves = await db.aiImageCreditEntry.aggregate({
    where: { organizationId, fromPlan: true, createdAt: { gte: window.start, lt: window.end } }, _sum: { delta: true },
  });
  const used = Math.max(0, -(moves._sum.delta ?? 0));
  const left = Math.max(0, total - used);
  return { used, total, planLeft: left, packBalance: 0, left, resetsAt: window.end };
}
