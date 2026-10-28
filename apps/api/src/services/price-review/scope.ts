import { Prisma } from "../../../generated/prisma/client.js";
import { IN_RANGE, likeTerm } from "../listing-sql.js";
import { UNBRANDED, type PriceReviewItemsQuery, type PriceReviewScope } from "@martly/shared/schemas";

export const EFFECTIVE_MRP = Prisma.sql`COALESCE(sp.mrp, v.mrp)`;

type Filter = Partial<Pick<PriceReviewItemsQuery, "outcome" | "departmentId" | "categoryId" | "subcategoryId" | "brandId" | "q">> & {
  status?: keyof typeof STATUS;
};

/** Which listings a status covers: not-sold ones leave the price queue for their own tab */
const STATUS = {
  pending: Prisma.sql`${IN_RANGE} AND sp.price_reviewed_at IS NULL`,
  reviewed: Prisma.sql`${IN_RANGE} AND sp.price_reviewed_at IS NOT NULL`,
  notCarried: Prisma.sql`sp.carried IS FALSE`,
  all: IN_RANGE,
  /** In range or not, for counting every tab at once */
  any: Prisma.sql`TRUE`,
};

/** WHERE clause over LISTINGS for one store and the picked filters */
export function listingWhere(storeId: string, f: Filter): Prisma.Sql {
  const parts = [Prisma.sql`sp.store_id = ${storeId}`, STATUS[f.status ?? "all"]];
  if (f.outcome) parts.push(Prisma.sql`sp.price_review_outcome = ${f.outcome}::"PriceReviewOutcome"`);
  if (f.departmentId) parts.push(Prisma.sql`c.department_id = ${f.departmentId}`);
  if (f.categoryId) parts.push(Prisma.sql`sc.category_id = ${f.categoryId}`);
  if (f.subcategoryId) parts.push(Prisma.sql`p.subcategory_id = ${f.subcategoryId}`);
  if (f.brandId) parts.push(f.brandId === UNBRANDED ? Prisma.sql`p.brand_id IS NULL` : Prisma.sql`p.brand_id = ${f.brandId}`);
  if (f.q) parts.push(Prisma.sql`(p.name ILIKE ${likeTerm(f.q)} OR b.name ILIKE ${likeTerm(f.q)})`);
  return Prisma.join(parts, " AND ");
}

/** Listings a bulk action touches: a brand, aisle or department settles only what's still pending; picked ids settle as picked */
export function scopeWhere(storeId: string, scope: PriceReviewScope): Prisma.Sql {
  if ("storeProductIds" in scope) return Prisma.sql`sp.store_id = ${storeId} AND sp.id IN (${Prisma.join(scope.storeProductIds)})`;
  return listingWhere(storeId, { ...scope, status: "pending" });
}
