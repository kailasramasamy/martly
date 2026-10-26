import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { JwtUser } from "../types/jwt.js";

type Db = Pick<Prisma.TransactionClient, "brand">;

export function slugify(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** First free slug of `name`, `name-2`, `name-3`… (slugs are unique across all organizations) */
export async function uniqueBrandSlug(db: Db, name: string): Promise<string> {
  const base = slugify(name) || "brand";
  const rows = await db.brand.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Brands a caller may see: master brands plus their own organization's (everything for the platform admin) */
export function brandVisibility(user: Pick<JwtUser, "role" | "organizationId"> | undefined): Prisma.BrandWhereInput {
  if (user?.role === "SUPER_ADMIN") return {};
  if (user?.organizationId) return { OR: [{ organizationId: null }, { organizationId: user.organizationId }] };
  return { organizationId: null };
}

/** A product may use a master brand or one owned by the product's organization */
export async function assertBrandUsable(db: Db, brandId: string | null | undefined, organizationId: string | null) {
  if (!brandId) return;
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { organizationId: true } });
  if (!brand || (brand.organizationId !== null && brand.organizationId !== organizationId)) {
    throw Object.assign(new Error("Unknown brand"), { statusCode: 400 });
  }
}

/** A store's brands for its brand rail: themed brands first, then the ones it carries most of */
export function storeBrands(prisma: PrismaClient, storeId: string, limit: number) {
  return prisma.$queryRaw<{ id: string; name: string; imageUrl: string | null; themeColor: string | null; productCount: number }[]>`
    SELECT b.id, b.name, b.image_url AS "imageUrl", b.theme_color AS "themeColor", COUNT(DISTINCT p.id)::int AS "productCount"
    FROM store_products sp
    JOIN products p ON p.id = sp.product_id
    JOIN brands b ON b.id = p.brand_id
    WHERE sp.store_id = ${storeId} AND sp.is_active = true AND p.is_active = true
    GROUP BY b.id
    ORDER BY (b.theme_color IS NOT NULL) DESC, "productCount" DESC, b.name ASC
    LIMIT ${limit}`;
}
