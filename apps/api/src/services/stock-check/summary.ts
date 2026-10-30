import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { StockCheckCounts, StockCheckDepartment, StockCheckSummary } from "@martly/shared/types";
import { istDay } from "../ist-day.js";
import { LISTINGS, utc } from "../listing-sql.js";
import { storeRegion } from "../brand-popularity.js";
import { COUNTS, sampleImages, samples } from "./counts.js";

/** How far a store is in confirming its range, overall and per department */
export async function stockCheckSummary(prisma: PrismaClient, storeId: string): Promise<StockCheckSummary> {
  const region = await storeRegion(prisma, storeId);
  const [[totals], departments] = await Promise.all([
    prisma.$queryRaw<(StockCheckCounts & { checkedToday: number })[]>`
      SELECT ${COUNTS}, count(*) FILTER (WHERE sp.carry_checked_at >= ${utc(istDay().start)})::int AS "checkedToday"
      FROM store_products sp WHERE sp.store_id = ${storeId}`,
    prisma.$queryRaw<(StockCheckDepartment & { sampleImages: string[] | null })[]>`
      SELECT d.id, d.name, ${COUNTS}, ${sampleImages(region)}
      FROM ${LISTINGS} JOIN departments d ON d.id = c.department_id
      WHERE sp.store_id = ${storeId}
      GROUP BY d.id, d.name, d.sort_order
      ORDER BY d.sort_order, d.name`,
  ]);
  return { ...totals, departments: departments.map((d) => ({ ...d, sampleImages: samples(d.sampleImages) })) };
}
