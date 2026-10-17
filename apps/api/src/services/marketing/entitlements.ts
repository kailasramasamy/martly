import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { istDateKey } from "../ist-day.js";

type Db = PrismaClient | Prisma.TransactionClient;

/** The plan every organisation is on when no paid period covers today */
export const FREE_PLAN_CODE = "FREE";

/** The organisation has used what its plan includes; the message says how to get more */
export class PaymentRequiredError extends Error {
  name = "PaymentRequiredError";
  statusCode = 402;
}

export type Entitlements = Awaited<ReturnType<typeof getEntitlements>>;

function activePeriod(db: Db, organizationId: string, at: Date) {
  return db.orgPlanPeriod.findFirst({
    where: { organizationId, startsAt: { lte: at }, endsAt: { gt: at } },
    orderBy: { startsAt: "desc" },
    include: { product: true },
  });
}

/** Free orgs get their allowance per IST calendar month */
function monthWindow(at: Date) {
  const [year, month] = istDateKey(at).split("-").map(Number);
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return { start, end: new Date(`${next}-01T00:00:00+05:30`) };
}

/** Banners that occupy a slot: the org's own, switched on and not yet over, except an AI promotion's launch banner */
export function slotBannerWhere(organizationId: string, now = new Date()): Prisma.BannerWhereInput {
  return {
    organizationId, sponsorType: "STORE", isActive: true, slotFree: false,
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
}

/** The plan in force, what it includes and how much of it is used */
export async function getEntitlements(db: Db, organizationId: string) {
  const now = new Date();
  const period = await activePeriod(db, organizationId, now);
  const plan = period?.product ?? (await db.adProduct.findUnique({ where: { code: FREE_PLAN_CODE } }));
  const window = period ? { start: period.startsAt, end: period.endsAt } : monthWindow(now);
  const [planMoves, topUp, slotsUsed, lastPeriod, aiImagesUsed] = await Promise.all([
    db.promotionCreditEntry.aggregate({ where: { organizationId, fromPlan: true, createdAt: { gte: window.start, lt: window.end } }, _sum: { delta: true } }),
    db.promotionCreditEntry.aggregate({ where: { organizationId, fromPlan: false }, _sum: { delta: true } }),
    db.banner.count({ where: slotBannerWhere(organizationId, now) }),
    db.orgPlanPeriod.findFirst({ where: { organizationId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" }, select: { endsAt: true } }),
    db.bannerArtRun.count({ where: { organizationId, purpose: "BANNER", createdAt: { gte: window.start, lt: window.end } } }),
  ]);
  const planTotal = plan?.promotionCredits ?? 0;
  const planUsed = Math.max(0, -(planMoves._sum.delta ?? 0));
  return {
    plan: plan && {
      id: plan.id, code: plan.code, name: plan.name, price: Number(plan.price),
      bannerSlots: plan.bannerSlots, promotionCredits: plan.promotionCredits, pushIncluded: plan.pushIncluded, aiImagesPerMonth: plan.aiImagesPerMonth,
    },
    period: period && { startsAt: period.startsAt, endsAt: period.endsAt },
    /** Last day covered by periods already bought, including ones that start later */
    paidThrough: lastPeriod?.endsAt ?? null,
    bannerSlots: { used: slotsUsed, total: plan ? plan.bannerSlots : 0 },
    promotions: { planUsed, planTotal, planLeft: Math.max(0, planTotal - planUsed), topUpBalance: topUp._sum.delta ?? 0, resetsAt: window.end },
    pushIncluded: plan?.pushIncluded ?? false,
    aiImages: { used: aiImagesUsed, total: plan?.aiImagesPerMonth ?? 0 },
  };
}

/**
 * Takes one promotion credit for a promo just created in this transaction: the plan's monthly allowance
 * first, then bought top-ups. A per-org advisory lock keeps two simultaneous creates from sharing a credit.
 */
export async function chargePromotion(tx: Prisma.TransactionClient, promo: { id: string; organizationId: string }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${promo.organizationId}))`;
  const { promotions } = await getEntitlements(tx, promo.organizationId);
  const charge = promotions.planLeft > 0 ? "PLAN" : promotions.topUpBalance > 0 ? "TOPUP" : null;
  if (!charge) {
    throw new PaymentRequiredError(
      promotions.planTotal > 0
        ? "You've used this month's promotions. Buy an extra promotion or upgrade your plan."
        : "Promotions need a paid plan. Upgrade your plan or buy an extra promotion.",
    );
  }
  await tx.promo.update({ where: { id: promo.id }, data: { chargedFrom: charge } });
  await tx.promotionCreditEntry.create({
    data: { organizationId: promo.organizationId, delta: -1, reason: "USED", promoId: promo.id, fromPlan: charge === "PLAN" },
  });
  return charge;
}

/** Gives back the credit of a promo that failed on our side; safe to call twice */
export async function refundPromotion(prisma: PrismaClient, promoId: string) {
  await prisma.$transaction(async (tx) => {
    const promo = await tx.promo.findUnique({ where: { id: promoId }, select: { organizationId: true, chargedFrom: true } });
    if (promo?.chargedFrom !== "PLAN" && promo?.chargedFrom !== "TOPUP") return;
    const { count } = await tx.promo.updateMany({ where: { id: promoId, chargedFrom: promo.chargedFrom }, data: { chargedFrom: null } });
    if (count) {
      await tx.promotionCreditEntry.create({
        data: { organizationId: promo.organizationId, delta: 1, reason: "REFUND", promoId, fromPlan: promo.chargedFrom === "PLAN" },
      });
    }
  });
}

/** Refuses a new or re-enabled banner when every slot of the plan is taken; locks so two saves can't share a slot */
export async function assertBannerSlot(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`banner-slots:${organizationId}`}))`;
  const { bannerSlots } = await getEntitlements(tx, organizationId);
  if (bannerSlots.total !== null && bannerSlots.used >= bannerSlots.total) {
    throw new PaymentRequiredError(
      bannerSlots.total === 0
        ? "Banners need a plan with banner slots. Upgrade your plan."
        : `All ${bannerSlots.total} banner slots are in use. Switch one off or upgrade your plan.`,
    );
  }
}
