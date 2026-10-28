import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import type { PriceReviewBulkInput, PriceReviewDecideInput, PriceReviewReopenInput } from "@martly/shared/schemas";
import type { PriceReviewOutcome } from "@martly/shared/constants";
import type { PriceReviewResult } from "@martly/shared/types";
import { LISTINGS, NOW_UTC, utc } from "../listing-sql.js";
import { carryUpdate, restoreCarried, setCarried } from "../stock-check/carry.js";
import { EFFECTIVE_MRP, scopeWhere } from "./scope.js";

const badRequest = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

const sameMoney = (a: unknown, b: unknown) => (a === null || a === undefined ? null : Number(a)) === (b === null || b === undefined ? null : Number(b));

/** Settle listings one by one: not sold here, change price/MRP, or keep as they are; the price may never exceed the MRP */
export async function decidePrices(prisma: PrismaClient, input: PriceReviewDecideInput, userId: string): Promise<PriceReviewResult> {
  const ids = input.items.map((i) => i.id);
  const listings = await prisma.storeProduct.findMany({
    where: { id: { in: ids }, storeId: input.storeId },
    select: { id: true, price: true, mrp: true, product: { select: { name: true } }, variant: { select: { name: true, mrp: true } } },
  });
  if (listings.length !== new Set(ids).size) throw badRequest("Some products aren't listed at this store");
  const byId = new Map(listings.map((l) => [l.id, l]));
  const batch = new Date();

  const hideIds = input.items.filter((i) => i.hide).map((i) => i.id);
  const updates = input.items.filter((i) => !i.hide).map((item) => {
    const sp = byId.get(item.id)!;
    const price = item.price ?? Number(sp.price);
    const mrp = item.mrp === undefined ? sp.mrp : item.mrp;
    const shownMrp = mrp ?? sp.variant.mrp;
    if (shownMrp !== null && price > Number(shownMrp)) {
      throw badRequest(`${sp.product.name} ${sp.variant.name}: price ₹${price} is above the MRP ₹${Number(shownMrp)}`);
    }
    const changed = !sameMoney(price, sp.price) || !sameMoney(mrp, sp.mrp);
    const outcome: PriceReviewOutcome = changed ? "CHANGED" : "KEPT";
    return prisma.storeProduct.update({
      where: { id: item.id },
      data: { price, mrp, priceReviewOutcome: outcome, priceReviewedAt: batch, priceReviewedById: userId },
    });
  });
  const hide = hideIds.length > 0 ? [carryUpdate(prisma, Prisma.sql`sp.store_id = ${input.storeId} AND sp.id IN (${Prisma.join(hideIds)})`, false, userId, batch)] : [];
  await prisma.$transaction([...updates, ...hide]);
  return { updated: input.items.length, batch: batch.toISOString() };
}

/** Settle a whole brand, aisle, department or picked set at once, in one statement */
export async function bulkDecide(prisma: PrismaClient, input: PriceReviewBulkInput, userId: string): Promise<PriceReviewResult> {
  const batch = new Date();
  const target = scopeWhere(input.storeId, input.scope);
  if (input.action === "hide") return setCarried(prisma, target, false, userId, batch);
  if (input.action === "percentOffMrp") {
    // Loose sizes have no MRP to work from, so they're left for a hand-entered price
    const newPrice = Prisma.sql`GREATEST(1, ROUND(${EFFECTIVE_MRP} * ${100 - input.percent} / 100))`;
    const updated = await prisma.$executeRaw`
      UPDATE store_products sp SET price = ${newPrice},
        price_review_outcome = (CASE WHEN sp.price = ${newPrice} THEN 'KEPT' ELSE 'CHANGED' END)::"PriceReviewOutcome",
        price_reviewed_at = ${utc(batch)}, price_reviewed_by_id = ${userId}, updated_at = ${NOW_UTC}
      FROM product_variants v
      WHERE v.id = sp.variant_id AND ${EFFECTIVE_MRP} IS NOT NULL
        AND sp.id IN (SELECT sp.id FROM ${LISTINGS} WHERE ${target})`;
    return { updated, batch: batch.toISOString() };
  }
  const updated = await prisma.$executeRaw`
    UPDATE store_products SET price_review_outcome = 'KEPT', price_reviewed_at = ${utc(batch)}, price_reviewed_by_id = ${userId}, updated_at = ${NOW_UTC}
    WHERE id IN (SELECT sp.id FROM ${LISTINGS} WHERE ${target})`;
  return { updated, batch: batch.toISOString() };
}

/** Put listings back in the queue (undo): not-sold ones go back to how they stood before; prices stay as they are */
export async function reopenPrices(prisma: PrismaClient, input: PriceReviewReopenInput, userId: string) {
  const [priced, carry] = "batch" in input
    ? [
      Prisma.sql`price_reviewed_at = ${utc(new Date(input.batch))} AND price_reviewed_by_id = ${userId}`,
      Prisma.sql`carry_checked_at = ${utc(new Date(input.batch))} AND carry_checked_by_id = ${userId}`,
    ]
    : [
      Prisma.sql`id IN (${Prisma.join(input.storeProductIds)}) AND price_reviewed_at IS NOT NULL`,
      Prisma.sql`id IN (${Prisma.join(input.storeProductIds)}) AND carried IS FALSE`,
    ];
  const [reopened, unhidden] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE store_products SET price_review_outcome = NULL, price_reviewed_at = NULL, price_reviewed_by_id = NULL, updated_at = ${NOW_UTC}
      WHERE store_id = ${input.storeId} AND ${priced}`,
    restoreCarried(prisma, input.storeId, carry),
  ]);
  return reopened + unhidden;
}
