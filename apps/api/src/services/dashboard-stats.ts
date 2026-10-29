import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { addDays } from "./ist-day.js";
import { utc } from "./listing-sql.js";

/** Orders `o` in one store, in a set of stores, or anywhere (`storeIds` undefined: Martly staff) */
export function ordersInScope(storeId: string | undefined, storeIds: string[] | undefined) {
  if (storeId) return Prisma.sql`o.store_id = ${storeId}`;
  if (storeIds !== undefined) return Prisma.sql`o.store_id = ANY(${storeIds}::text[])`;
  return Prisma.sql`TRUE`;
}

/** Distinct customers who ordered since `periodStart`, and in the span from `previousStart` up to it */
export async function customerCounts(prisma: PrismaClient, scope: Prisma.Sql, periodStart: Date, previousStart: Date) {
  const [row] = await prisma.$queryRaw<{ current: number; previous: number }[]>`
    SELECT COUNT(DISTINCT o.user_id) FILTER (WHERE o.created_at >= ${utc(periodStart)})::int AS current,
      COUNT(DISTINCT o.user_id) FILTER (WHERE o.created_at < ${utc(periodStart)})::int AS previous
    FROM orders o WHERE ${scope} AND o.created_at >= ${utc(previousStart)}`;
  return row;
}

/** Orders and revenue per IST day for the `days` days ending today, every day present (zero when quiet) */
export async function dailyTotals(prisma: PrismaClient, scope: Prisma.Sql, periodStart: Date, todayKey: string, days: number) {
  // created_at is UTC wall time; shifting it by India's offset gives the IST calendar day
  const rows = await prisma.$queryRaw<{ day: string; count: number; revenue: Prisma.Decimal }[]>`
    SELECT to_char(o.created_at + interval '5 hours 30 minutes', 'YYYY-MM-DD') AS day, COUNT(*)::int AS count, SUM(o.total_amount) AS revenue
    FROM orders o WHERE ${scope} AND o.created_at >= ${utc(periodStart)}
    GROUP BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(todayKey, i - (days - 1));
    const row = byDay.get(date);
    return { date, count: row?.count ?? 0, revenue: Math.round((row?.revenue.toNumber() ?? 0) * 100) / 100 };
  });
}
