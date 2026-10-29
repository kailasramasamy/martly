import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

export type FundedBy = "ORG" | "PLATFORM";

/** The organization (and store, when tied to an order) that pays for a support wallet adjustment */
export interface GoodwillPayer {
  organizationId: string;
  storeId: string | null;
  orderId: string | null;
}

const fail = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

/**
 * Org staff always adjust at their organization's cost. A super admin's adjustment is Martly's goodwill unless
 * they charge it to the store that took the order. Null means Martly bears it and the ledger is untouched.
 */
export async function goodwillPayer(
  prisma: PrismaClient,
  actor: { role: string; organizationId?: string },
  customerId: string,
  input: { orderId?: string; fundedBy?: FundedBy },
): Promise<GoodwillPayer | null> {
  const fundedBy: FundedBy = actor.role === "SUPER_ADMIN" ? input.fundedBy ?? "PLATFORM" : "ORG";
  if (fundedBy === "PLATFORM") return null;

  if (!input.orderId) {
    if (actor.role === "SUPER_ADMIN") throw fail("Pick the order to charge this to the store");
    return { organizationId: actor.organizationId!, storeId: null, orderId: null };
  }
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { userId: true, storeId: true, store: { select: { organizationId: true } } },
  });
  if (!order || order.userId !== customerId) throw fail("That order isn't this customer's");
  if (actor.role !== "SUPER_ADMIN" && order.store.organizationId !== actor.organizationId) throw fail("That order isn't from your stores");
  return { organizationId: order.store.organizationId, storeId: order.storeId, orderId: input.orderId };
}

/** Support credit an organization gave a customer and hasn't taken back yet: the most its staff may debit */
export async function supportCreditLeft(tx: Prisma.TransactionClient, userId: string, organizationId: string): Promise<number> {
  const sums = await tx.walletTransaction.groupBy({
    by: ["type"],
    where: { userId, organizationId, reason: "SUPPORT" },
    _sum: { amount: true },
  });
  const total = (type: string) => Number(sums.find((s) => s.type === type)?._sum.amount ?? 0);
  return Math.max(total("CREDIT") - total("DEBIT"), 0);
}
