import type { PrismaClient } from "../../../generated/prisma/client.js";

/** The plan onboarding includes, and for how long */
export const ONBOARDING_PLAN = { code: "GROWTH", days: 90 };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Makes a pending store live. An organisation's first launch also starts the Growth months its onboarding fee
 * includes; a later store, or an organisation that has had any plan, gets none.
 */
export async function launchStore(prisma: PrismaClient, storeId: string) {
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.update({ where: { id: storeId }, data: { status: "ACTIVE", launchedAt: new Date() } });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`onboarding-plan:${store.organizationId}`}))`;
    if (!(await tx.orgPlanPeriod.count({ where: { organizationId: store.organizationId } }))) {
      const product = await tx.adProduct.findUniqueOrThrow({ where: { code: ONBOARDING_PLAN.code } });
      const startsAt = new Date();
      await tx.orgPlanPeriod.create({
        data: { organizationId: store.organizationId, productId: product.id, isTrial: false, startsAt, endsAt: new Date(startsAt.getTime() + ONBOARDING_PLAN.days * DAY_MS) },
      });
    }
    return store;
  });
}
