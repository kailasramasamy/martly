import { MARTLY_CREDIT_FUNDER } from "@martly/shared/constants";
import type { CheckoutCredit } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { utc } from "../listing-sql.js";
import { isNewCustomer } from "./grants.js";

type Db = PrismaClient | Prisma.TransactionClient;
type Tx = Prisma.TransactionClient;

interface UsableRow {
  id: string;
  amount: Prisma.Decimal;
  min_order_amount: Prisma.Decimal;
  funder_key: string;
}

/**
 * The welcome credit a first order at this store takes off: each unexpired grant from Martly or the store whose
 * minimum the order (items less coupon) meets, never more than the order. Inside checkout the grants are locked.
 */
export async function usableCredit(db: Db, userId: string, storeId: string, orderAmount: number, lock = false): Promise<CheckoutCredit> {
  const rows = await db.$queryRaw<UsableRow[]>`
    SELECT g.id, g.amount, c.min_order_amount, g.funder_key
    FROM credit_grants g JOIN credit_campaigns c ON c.id = g.campaign_id
    WHERE g.user_id = ${userId} AND g.status = 'ACTIVE' AND g.expires_at > ${utc(new Date())}
      AND g.funder_key IN (${MARTLY_CREDIT_FUNDER}, ${storeId})
    ORDER BY g.expires_at
    ${lock ? Prisma.sql`FOR UPDATE OF g` : Prisma.empty}`;
  const credit: CheckoutCredit = { amount: 0, grantIds: [] };
  for (const g of rows) {
    const amount = Number(g.amount);
    if (orderAmount < Number(g.min_order_amount) || credit.amount + amount > orderAmount) continue;
    if (!await isNewCustomer(db, userId, g.funder_key === MARTLY_CREDIT_FUNDER ? null : storeId)) continue;
    credit.amount += amount;
    credit.grantIds.push(g.id);
  }
  return credit;
}

/** Holds the grants for a placed order */
export async function reserveCredits(tx: Tx, orderId: string, grantIds: string[]) {
  if (grantIds.length === 0) return;
  await tx.creditGrant.updateMany({ where: { id: { in: grantIds }, status: "ACTIVE" }, data: { status: "RESERVED", orderId } });
}

/** A cancelled order gives its credit back, unless the credit expired meanwhile */
export async function releaseCredits(tx: Tx, orderId: string) {
  const now = new Date();
  await tx.creditGrant.updateMany({ where: { orderId, status: "RESERVED", expiresAt: { gt: now } }, data: { status: "ACTIVE", orderId: null } });
  await tx.creditGrant.updateMany({ where: { orderId, status: "RESERVED" }, data: { status: "EXPIRED", orderId: null } });
}

/** Delivery spends the order's credit, which is when it counts against the campaign budget */
export async function spendCredits(tx: Tx, orderId: string) {
  await tx.creditGrant.updateMany({ where: { orderId, status: "RESERVED" }, data: { status: "USED", usedAt: new Date() } });
}

/** An undone delivery holds the credit again, as before delivery */
export async function unspendCredits(tx: Tx, orderId: string) {
  await tx.creditGrant.updateMany({ where: { orderId, status: "USED" }, data: { status: "RESERVED", usedAt: null } });
}

/** Martly-funded credit on an order, which Martly pays the store on delivery */
export async function martlyCreditOn(tx: Tx, orderId: string) {
  const sum = await tx.creditGrant.aggregate({ where: { orderId, funderKey: MARTLY_CREDIT_FUNDER }, _sum: { amount: true } });
  return Number(sum._sum.amount ?? 0);
}
