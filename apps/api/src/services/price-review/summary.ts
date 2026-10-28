import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { PriceReviewDepartment, PriceReviewSummary } from "@martly/shared/types";
import { istDay } from "../ist-day.js";
import { IN_RANGE, soldCte, utc } from "../listing-sql.js";

type Totals = Omit<PriceReviewSummary, "departments">;

/** Progress on a store's price review: how much is settled and how, and what's left per department */
export async function priceReviewSummary(prisma: PrismaClient, storeId: string): Promise<PriceReviewSummary> {
  const [[totals], departments] = await Promise.all([
    prisma.$queryRaw<Totals[]>`
      WITH ${soldCte(storeId)}
      SELECT count(*) FILTER (WHERE ${IN_RANGE})::int AS "total",
        count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_reviewed_at IS NULL)::int AS "pending",
        count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_reviewed_at IS NOT NULL)::int AS "reviewed",
        count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_review_outcome = 'KEPT')::int AS "kept",
        count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_review_outcome = 'CHANGED')::int AS "changed",
        count(*) FILTER (WHERE sp.carried IS FALSE)::int AS "notCarried",
        count(*) FILTER (WHERE ${IN_RANGE} AND sp.mrp IS NOT NULL)::int AS "mrpCorrected",
        count(*) FILTER (WHERE sp.price_reviewed_at >= ${utc(istDay().start)})::int AS "reviewedToday",
        count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_reviewed_at IS NULL AND sold.units > 0)::int AS "topSellersPending"
      FROM store_products sp LEFT JOIN sold ON sold.store_product_id = sp.id
      WHERE sp.store_id = ${storeId}`,
    prisma.$queryRaw<PriceReviewDepartment[]>`
      SELECT d.id, d.name, count(*)::int AS "total", count(*) FILTER (WHERE sp.price_reviewed_at IS NULL)::int AS "pending"
      FROM store_products sp
        JOIN products p ON p.id = sp.product_id
        JOIN subcategories sc ON sc.id = p.subcategory_id
        JOIN categories c ON c.id = sc.category_id
        JOIN departments d ON d.id = c.department_id
      WHERE sp.store_id = ${storeId} AND ${IN_RANGE}
      GROUP BY d.id, d.name, d.sort_order
      ORDER BY d.sort_order, d.name`,
  ]);
  return { ...totals, departments };
}

