import type { Prisma } from "../../../generated/prisma/client.js";
import type { ResolveReturnRequestInput } from "@martly/shared/schemas";
import { loadReturn, settleReturn, type ReturnWithItems, type SettleOutcome } from "./settle.js";

type Tx = Prisma.TransactionClient;

export interface ResolveResult {
  rr: ReturnWithItems;
  outcome: SettleOutcome;
}

/** Approve with a remedy and return method, or reject. Refunds only move once the item is back (or kept). */
export async function resolveReturn(tx: Tx, id: string, body: ResolveReturnRequestInput, userId: string): Promise<ResolveResult> {
  const pending = await loadReturn(tx, id);
  if (!pending) throw Object.assign(new Error("Return request not found"), { statusCode: 404 });
  const base = { adminNote: body.adminNote, resolvedAt: new Date(), resolvedBy: userId };

  if (body.status === "REJECTED") {
    await claimPending(tx, id, { ...base, status: "REJECTED" });
    return { rr: (await loadReturn(tx, id))!, outcome: { refunded: null, completed: false } };
  }

  const requested = Number(pending.requestedAmount);
  const approvedAmount = Math.min(body.approvedAmount ?? requested, requested);
  await claimPending(tx, id, { ...base, status: "IN_PROGRESS", remedy: body.remedy, method: body.method, approvedAmount });

  const restockIds = body.method === "KEEP" ? [] : (body.restockItemIds ?? []);
  if (restockIds.length) {
    await tx.returnRequestItem.updateMany({ where: { returnRequestId: id, id: { in: restockIds } }, data: { restock: true } });
  }
  const rr = (await loadReturn(tx, id))!;
  return { rr, outcome: await settleReturn(tx, rr) };
}

/** Resolve only while still pending, so two staff can't both act on it */
async function claimPending(tx: Tx, id: string, data: Prisma.ReturnRequestUpdateManyMutationInput) {
  const claim = await tx.returnRequest.updateMany({ where: { id, status: "PENDING" }, data });
  if (claim.count === 0) throw Object.assign(new Error("Return request has already been resolved"), { statusCode: 400 });
}
