import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { applyMovement } from "./stock-ledger.js";

type Tx = Prisma.TransactionClient;

export class CountReviewError extends Error {}

interface ApplyLine { id: string; storeProductId: string; countedQty: number; systemQty: number | null }

/** Applies one line's difference (counted − system at submit) as a COUNT movement and marks it applied */
async function applyLine(tx: Tx, countId: string, line: ApplyLine, userId: string, note?: string) {
  const difference = line.countedQty - (line.systemQty ?? line.countedQty);
  if (difference !== 0) {
    await applyMovement(tx, { storeProductId: line.storeProductId, quantity: difference, type: "COUNT", stockCountId: countId, userId, note });
  }
  await tx.stockCountLine.update({ where: { id: line.id }, data: { appliedAt: new Date() } });
}

/**
 * Submits a count, or the recount of its flagged lines: snapshots system stock for those lines and logs them in the
 * line history, so the approver sees what was counted when. A recount must cover every flagged line.
 */
export async function submitCount(prisma: PrismaClient, countId: string, recount: boolean, userId: string) {
  const lines = await prisma.stockCountLine.findMany({
    where: { stockCountId: countId, ...(recount ? { recountRequested: true } : {}) },
    select: { id: true, recountQty: true, countedQty: true, storeProduct: { select: { stock: true } } },
  });
  if (lines.length === 0) throw new CountReviewError("Count at least one product before submitting");
  if (recount && lines.some((l) => l.recountQty === null)) throw new CountReviewError("Recount every requested product before submitting");

  await prisma.$transaction(async (tx) => {
    for (const l of lines) {
      const qty = recount ? (l.recountQty as number) : l.countedQty;
      await tx.stockCountLine.update({
        where: { id: l.id },
        data: { countedQty: qty, systemQty: l.storeProduct.stock, recountQty: null, recountRequested: false },
      });
      await tx.stockCountLineRevision.create({ data: { lineId: l.id, kind: recount ? "RECOUNT" : "COUNT", qty, userId } });
    }
    await tx.stockCount.update({ where: { id: countId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  });
}

/** Approves a submitted count: applies every line not already applied when its recount was requested */
export async function approveCount(prisma: PrismaClient, countId: string, reviewerId: string, note: string | undefined) {
  await prisma.$transaction(async (tx) => {
    const lines = await tx.stockCountLine.findMany({ where: { stockCountId: countId, appliedAt: null } });
    for (const line of lines) await applyLine(tx, countId, line, reviewerId, note);
    await tx.stockCount.update({
      where: { id: countId },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note },
    });
  });
}

interface RecountRequest { storeProductIds: string[]; note?: string; approveRest: boolean }

/** Sends chosen lines back to the counter (blind); optionally applies the rest to stock now */
export async function requestRecount(prisma: PrismaClient, countId: string, req: RecountRequest, reviewerId: string) {
  const lines = await prisma.stockCountLine.findMany({ where: { stockCountId: countId } });
  const wanted = new Set(req.storeProductIds);
  const flagged = lines.filter((l) => wanted.has(l.storeProductId));
  if (flagged.length !== wanted.size) throw new CountReviewError("Only counted products can be sent for recount");
  if (flagged.some((l) => l.appliedAt)) throw new CountReviewError("Some of these products are already applied to stock");

  await prisma.$transaction(async (tx) => {
    await tx.stockCountLine.updateMany({ where: { id: { in: flagged.map((l) => l.id) } }, data: { recountRequested: true, recountQty: null } });
    if (req.approveRest) {
      for (const line of lines.filter((l) => !wanted.has(l.storeProductId) && !l.appliedAt)) {
        await applyLine(tx, countId, line, reviewerId, req.note);
      }
    }
    await tx.stockCount.update({
      where: { id: countId },
      data: { status: "RECOUNT", reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: req.note ?? null },
    });
  });
}

/** Approver overrides one line's quantity; the counter's figure stays in the line history */
export async function correctLine(prisma: PrismaClient, countId: string, storeProductId: string, qty: number, reason: string, reviewerId: string) {
  const line = await prisma.stockCountLine.findUnique({ where: { stockCountId_storeProductId: { stockCountId: countId, storeProductId } } });
  if (!line) throw new CountReviewError("This product wasn't counted");
  if (line.appliedAt) throw new CountReviewError("This product is already applied to stock");
  await prisma.$transaction([
    prisma.stockCountLine.update({ where: { id: line.id }, data: { countedQty: qty } }),
    prisma.stockCountLineRevision.create({ data: { lineId: line.id, kind: "CORRECTION", qty, reason, userId: reviewerId } }),
  ]);
}
