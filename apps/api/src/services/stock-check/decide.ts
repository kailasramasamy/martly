import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import type { StockCheckDecideInput, StockCheckSizesInput } from "@martly/shared/schemas";
import type { StockCheckResult } from "@martly/shared/types";
import { NOW_UTC, utc } from "../listing-sql.js";
import { setCarried } from "./carry.js";
import { scopeWhere } from "./listing.js";

const badRequest = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

/** A whole department or brand (its unconfirmed listings) or picked listings: carried, or not sold here */
export const decideCarried = (prisma: PrismaClient, input: StockCheckDecideInput, userId: string) =>
  setCarried(prisma, scopeWhere(input.storeId, input.scope), input.carried, userId);

/** The sizes screen: every size on it, on or off, saved together */
export async function saveSizes(prisma: PrismaClient, input: StockCheckSizesInput, userId: string): Promise<StockCheckResult> {
  const ids = input.items.map((i) => i.id);
  const owned = await prisma.storeProduct.count({ where: { id: { in: ids }, storeId: input.storeId } });
  if (owned !== new Set(ids).size) throw badRequest("Some products aren't listed at this store");
  const batch = new Date();
  const values = Prisma.join(input.items.map((i) => Prisma.sql`(${i.id}, ${i.carried})`));
  // carried_before takes the old value, so undo puts each size back as it was
  const updated = await prisma.$executeRaw`
    UPDATE store_products sp SET carried_before = sp.carried, carried = v.carried, is_active = v.carried,
      carry_checked_at = ${utc(batch)}, carry_checked_by_id = ${userId}, updated_at = ${NOW_UTC}
    FROM (VALUES ${values}) AS v(id, carried)
    WHERE sp.id = v.id AND sp.store_id = ${input.storeId}`;
  return { updated, batch: batch.toISOString() };
}
