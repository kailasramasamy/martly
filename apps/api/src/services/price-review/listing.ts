import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { UNBRANDED, type PriceReviewGroupsQuery, type PriceReviewItemsQuery } from "@martly/shared/schemas";
import type { PriceReviewCounts, PriceReviewGroup, PriceReviewItem } from "@martly/shared/types";
import { IN_RANGE, LISTINGS, soldCte } from "../listing-sql.js";
import { EFFECTIVE_MRP, listingWhere } from "./scope.js";

/** Priced under this share of MRP looks like a typo worth a second look */
const SUSPICIOUS_SHARE = 0.5;

type Counted<T> = T & { totalCount: number };

const GROUP_KEYS = {
  brand: { id: Prisma.sql`COALESCE(b.id, ${UNBRANDED})`, name: Prisma.sql`COALESCE(b.name, 'Unbranded')`, image: Prisma.sql`b.image_url`, rank: Prisma.sql`, COALESCE(MAX(b.popularity), 0) DESC`, only: Prisma.empty },
  subcategory: { id: Prisma.sql`sc.id`, name: Prisma.sql`sc.name`, image: Prisma.sql`sc.image_url`, rank: Prisma.empty, only: Prisma.sql` AND sc.id IS NOT NULL` },
} as const;

const HAVING = {
  pending: Prisma.sql`HAVING count(*) FILTER (WHERE sp.price_reviewed_at IS NULL) > 0`,
  reviewed: Prisma.sql`HAVING count(*) FILTER (WHERE sp.price_reviewed_at IS NOT NULL) > 0`,
  notCarried: Prisma.empty,
  all: Prisma.empty,
};

/** Brands or aisles to settle in one go, those that sell most (then best-known brands) first */
export async function priceReviewGroups(prisma: PrismaClient, query: PriceReviewGroupsQuery) {
  const key = GROUP_KEYS[query.by];
  const status = query.status === "notCarried" ? "notCarried" : "all";
  const where = listingWhere(query.storeId, { status, departmentId: query.departmentId, q: query.q });
  const rows = await prisma.$queryRaw<Counted<PriceReviewGroup>[]>`
    WITH ${soldCte(query.storeId)}
    SELECT ${key.id} AS "id", ${key.name} AS "name", ${key.image} AS "imageUrl",
      count(*)::int AS "total",
      count(*) FILTER (WHERE sp.price_reviewed_at IS NULL)::int AS "pending",
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY (1 - sp.price / ${EFFECTIVE_MRP}) * 100)
        FILTER (WHERE ${EFFECTIVE_MRP} > 0))::int AS "typicalOffPct",
      count(*) OVER ()::int AS "totalCount"
    FROM ${LISTINGS} LEFT JOIN sold ON sold.store_product_id = sp.id
    WHERE ${where}${key.only}
    GROUP BY 1, 2, 3
    ${HAVING[query.status]}
    ORDER BY COALESCE(SUM(sold.units), 0) DESC${key.rank}, 5 DESC, 2
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
  return { items: rows.map(({ totalCount: _, ...g }) => g), total: rows[0]?.totalCount ?? 0 };
}

type ItemRow = Omit<PriceReviewItem, "mrp" | "masterMrp" | "price" | "offPct" | "suspicious" | "reviewedAt"> & {
  mrp: Prisma.Decimal | null; masterMrp: Prisma.Decimal | null; price: Prisma.Decimal; reviewedAt: Date | null; totalCount: number;
};

const ITEM_ORDER = {
  priority: Prisma.sql`COALESCE(sold.units, 0) DESC, COALESCE(b.popularity, 0) DESC, p.name, v.unit_value, sp.id`,
  name: Prisma.sql`p.name, v.unit_value, sp.id`,
  // Just-settled first, so a mistake is easy to find and reopen
  recent: Prisma.sql`sp.price_reviewed_at DESC, sp.id`,
};

function toItem({ totalCount: _, ...r }: ItemRow): PriceReviewItem {
  const mrp = r.mrp === null ? null : Number(r.mrp);
  const price = Number(r.price);
  return {
    ...r,
    mrp,
    masterMrp: r.masterMrp === null ? null : Number(r.masterMrp),
    price,
    offPct: mrp ? Math.round((1 - price / mrp) * 100) : null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    suspicious: mrp !== null && price < mrp * SUSPICIOUS_SHARE,
  };
}

/** Pending and settled-by-outcome counts for the queue's brand/aisle/search, whichever tab is open */
async function queueCounts(prisma: PrismaClient, query: PriceReviewItemsQuery): Promise<PriceReviewCounts> {
  const [counts] = await prisma.$queryRaw<PriceReviewCounts[]>`
    SELECT count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_reviewed_at IS NULL)::int AS "pending",
      count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_review_outcome = 'KEPT')::int AS "KEPT",
      count(*) FILTER (WHERE ${IN_RANGE} AND sp.price_review_outcome = 'CHANGED')::int AS "CHANGED",
      count(*) FILTER (WHERE sp.carried IS FALSE)::int AS "notCarried"
    FROM ${LISTINGS}
    WHERE ${listingWhere(query.storeId, { ...query, status: "any", outcome: undefined })}`;
  return counts;
}

/** One page of listings to review, best sellers first; reviewed ones come newest first */
export async function priceReviewItems(prisma: PrismaClient, query: PriceReviewItemsQuery) {
  const order = query.status === "reviewed" && query.sort === "priority" ? ITEM_ORDER.recent : ITEM_ORDER[query.sort];
  const rowsQuery = prisma.$queryRaw<ItemRow[]>`
    WITH ${soldCte(query.storeId)}
    SELECT sp.id, sp.product_id AS "productId", p.name AS "productName", v.name AS "variantName",
      COALESCE(v.image_url, p.image_url) AS "imageUrl", b.name AS "brandName", COALESCE(sc.name, '') AS "subcategoryName",
      ${EFFECTIVE_MRP} AS "mrp", v.mrp AS "masterMrp", sp.price, sp.stock, sp.is_active AS "isActive", sp.carried,
      sp.price_review_outcome::text AS "outcome", sp.price_reviewed_at AS "reviewedAt",
      COALESCE(sold.units, 0)::int AS "unitsSold30d", count(*) OVER ()::int AS "totalCount"
    FROM ${LISTINGS} LEFT JOIN sold ON sold.store_product_id = sp.id
    WHERE ${listingWhere(query.storeId, query)}
    ORDER BY ${order}
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
  const [rows, counts] = await Promise.all([rowsQuery, queueCounts(prisma, query)]);
  return { items: rows.map(toItem), total: rows[0]?.totalCount ?? 0, counts };
}
