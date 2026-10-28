import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import type { StockCheckResult } from "@martly/shared/types";
import { LISTINGS, NOW_UTC, utc } from "../listing-sql.js";

/** Mark every listing matching `where` (over LISTINGS) carried or not, remembering what it was so undo can put it back */
export const carryUpdate = (prisma: PrismaClient, where: Prisma.Sql, carried: boolean, userId: string, batch: Date) =>
  prisma.$executeRaw`
    UPDATE store_products SET carried_before = carried, carried = ${carried}, is_active = ${carried},
      carry_checked_at = ${utc(batch)}, carry_checked_by_id = ${userId}, updated_at = ${NOW_UTC}
    WHERE id IN (SELECT sp.id FROM ${LISTINGS} WHERE ${where})`;

export async function setCarried(
  prisma: PrismaClient, where: Prisma.Sql, carried: boolean, userId: string, batch = new Date(),
): Promise<StockCheckResult> {
  const updated = await carryUpdate(prisma, where, carried, userId, batch);
  return { updated, batch: batch.toISOString() };
}

/** Back to how each listing stood before its last check; unconfirmed ones show exactly as onboarding left them */
export function restoreCarried(prisma: PrismaClient, storeId: string, which: Prisma.Sql) {
  return prisma.$executeRaw`
    UPDATE store_products SET carried = carried_before, is_active = COALESCE(carried_before, NOT suggested), carried_before = NULL,
      carry_checked_at = NULL, carry_checked_by_id = NULL, updated_at = ${NOW_UTC}
    WHERE store_id = ${storeId} AND ${which}`;
}

/** Undo one call: every listing it settled carries its batch time */
export const undoBatch = (prisma: PrismaClient, storeId: string, batch: string, userId: string) =>
  restoreCarried(prisma, storeId, Prisma.sql`carry_checked_at = ${utc(new Date(batch))} AND carry_checked_by_id = ${userId}`);
