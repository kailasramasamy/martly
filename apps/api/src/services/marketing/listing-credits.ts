import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { LISTING_FEE, OWN_LISTINGS_INCLUDED } from "@martly/shared/constants";
import { FREE_PLAN_CODE, PaymentRequiredError } from "./entitlements.js";

type Db = PrismaClient | Prisma.TransactionClient;

export const NO_LISTINGS_LEFT = `You've used your free product listings. Buy more listings for ₹${LISTING_FEE} each in Marketing plan.`;

/** The plan running now, or Free */
async function planCode(db: Db, organizationId: string) {
  const now = new Date();
  const period = await db.orgPlanPeriod.findFirst({
    where: { organizationId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
    select: { product: { select: { code: true } } },
  });
  return period?.product.code ?? FREE_PLAN_CODE;
}

/**
 * Own-product listings: the plan's free ones are counted over the org's life, so a bigger plan adds to what's
 * left and a smaller one never takes listed products away; bought listings are a balance that never expires
 */
export async function listingBalance(db: Db, organizationId: string, code?: string) {
  const [plan, fromPlan, bought, org] = await Promise.all([
    code ?? planCode(db, organizationId),
    db.listingCreditEntry.aggregate({ where: { organizationId, fromPlan: true }, _sum: { delta: true } }),
    db.listingCreditEntry.aggregate({ where: { organizationId, fromPlan: false }, _sum: { delta: true } }),
    db.organization.findUnique({ where: { id: organizationId }, select: { unlimitedListings: true } }),
  ]);
  const included = OWN_LISTINGS_INCLUDED[plan] ?? 0;
  const used = Math.max(0, -(fromPlan._sum.delta ?? 0));
  const extraBalance = bought._sum.delta ?? 0;
  /** Martly lets some organisations (e.g. beta stores) list without limit; their listings still count as used */
  const unlimited = org?.unlimitedListings ?? false;
  return { included, used, planLeft: Math.max(0, included - used), extraBalance, unlimited };
}

export const listingsLeft = (b: { planLeft: number; extraBalance: number; unlimited: boolean }) => (b.unlimited ? Infinity : b.planLeft + b.extraBalance);

/** Takes one listing for an own product created in this transaction: the plan's free ones first, then bought ones */
export async function chargeListing(tx: Prisma.TransactionClient, organizationId: string, productId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`listing:${organizationId}`}))`;
  const balance = await listingBalance(tx, organizationId);
  // Unlimited organisations never spend bought listings; theirs count against the plan, which may go past what it includes
  const fromPlan = balance.planLeft > 0 || balance.unlimited;
  if (!fromPlan && balance.extraBalance <= 0) throw new PaymentRequiredError(NO_LISTINGS_LEFT);
  await tx.listingCreditEntry.create({ data: { organizationId, delta: -1, reason: "USED", productId, fromPlan } });
}

/** Gives back the listing a deleted own product used, to the pool it came from */
export async function refundListing(tx: Prisma.TransactionClient, productId: string) {
  const used = await tx.listingCreditEntry.findFirst({ where: { productId, reason: "USED" }, orderBy: { createdAt: "desc" } });
  if (!used) return;
  await tx.listingCreditEntry.create({ data: { organizationId: used.organizationId, delta: 1, reason: "REFUND", productId, fromPlan: used.fromPlan } });
}
