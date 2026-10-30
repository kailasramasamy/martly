import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { UNBRANDED, type CarryState, type StockCheckBrandsQuery, type StockCheckProductsQuery, type StockCheckScope } from "@martly/shared/schemas";
import type { StockCheckBrand, StockCheckProduct, StockCheckSize } from "@martly/shared/types";
import { LISTINGS, likeTerm, soldCte } from "../listing-sql.js";
import { brandPopularitySql, storeRegion } from "../brand-popularity.js";
import { COUNTS, sampleImages, samples } from "./counts.js";

const brandFilter = (brandId: string) => (brandId === UNBRANDED ? Prisma.sql`p.brand_id IS NULL` : Prisma.sql`p.brand_id = ${brandId}`);

const STATE: Record<CarryState, Prisma.Sql> = {
  unchecked: Prisma.sql`sp.carried IS NULL`,
  carried: Prisma.sql`sp.carried IS TRUE`,
  notCarried: Prisma.sql`sp.carried IS FALSE`,
};

/** Listings a decision touches: a department or brand only those in one state (unconfirmed unless said); picked ids as picked */
export function scopeWhere(storeId: string, scope: StockCheckScope): Prisma.Sql {
  if ("storeProductIds" in scope) return Prisma.sql`sp.store_id = ${storeId} AND sp.id IN (${Prisma.join(scope.storeProductIds)})`;
  const parts = [Prisma.sql`sp.store_id = ${storeId}`, Prisma.sql`c.department_id = ${scope.departmentId}`, STATE[scope.only ?? "unchecked"]];
  if (scope.brandId) parts.push(brandFilter(scope.brandId));
  return Prisma.join(parts, " AND ");
}

type BrandRow = Omit<StockCheckBrand, "sampleImages"> & { sampleImages: string[] | null; totalCount: number };

/** A department's brands with listings in one state (or all), those the store sells most (then best-known) first */
export async function stockCheckBrands(prisma: PrismaClient, query: StockCheckBrandsQuery) {
  const search = query.q ? Prisma.sql` AND (b.name ILIKE ${likeTerm(query.q)} OR p.name ILIKE ${likeTerm(query.q)})` : Prisma.empty;
  const region = await storeRegion(prisma, query.storeId);
  const having = query.status === "all" ? Prisma.empty : Prisma.sql`HAVING count(*) FILTER (WHERE ${STATE[query.status]}) > 0`;
  const rows = await prisma.$queryRaw<BrandRow[]>`
    WITH ${soldCte(query.storeId)}
    SELECT COALESCE(b.id, ${UNBRANDED}) AS "id", COALESCE(b.name, 'Unbranded') AS "name", b.image_url AS "imageUrl",
      ${COUNTS}, ${sampleImages(region)}, count(*) OVER ()::int AS "totalCount"
    FROM ${LISTINGS} LEFT JOIN sold ON sold.store_product_id = sp.id
    WHERE sp.store_id = ${query.storeId} AND c.department_id = ${query.departmentId}${search}
    GROUP BY 1, 2, 3
    ${having}
    ORDER BY COALESCE(SUM(sold.units), 0) DESC, COALESCE(MAX(${brandPopularitySql(region)}), 0) DESC, 2
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
  const items = rows.map(({ totalCount: _, ...r }) => ({ ...r, sampleImages: samples(r.sampleImages) }));
  return { items, total: rows[0]?.totalCount ?? 0 };
}

type SizeRow = StockCheckSize & { productId: string; productName: string; productImage: string | null };

const inState: Record<CarryState, (s: StockCheckSize) => boolean> = {
  unchecked: (s) => s.carried === null,
  carried: (s) => s.carried === true,
  notCarried: (s) => s.carried === false,
};

/** A brand's products in one department, each with all its sizes for the on/off chips; only those with a size in `status` */
export async function stockCheckProducts(prisma: PrismaClient, query: StockCheckProductsQuery): Promise<StockCheckProduct[]> {
  const rows = await prisma.$queryRaw<SizeRow[]>`
    SELECT sp.id AS "storeProductId", v.name AS "variantName", COALESCE(sp.mrp, v.mrp)::float AS "mrp", sp.price::float AS "price",
      sp.carried, sp.is_active AS "isActive", sp.suggested,
      p.id AS "productId", p.name AS "productName", p.image_url AS "productImage"
    FROM ${LISTINGS}
    WHERE sp.store_id = ${query.storeId} AND c.department_id = ${query.departmentId} AND ${brandFilter(query.brandId)}
    ORDER BY p.name, v.unit_value, v.name`;
  const products = new Map<string, StockCheckProduct>();
  for (const { productId, productName, productImage, ...size } of rows) {
    const product = products.get(productId) ?? { id: productId, name: productName, imageUrl: productImage, sizes: [] };
    product.sizes.push(size);
    products.set(productId, product);
  }
  const { status } = query;
  const all = [...products.values()];
  return status === "all" ? all : all.filter((p) => p.sizes.some(inState[status]));
}
