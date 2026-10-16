import type { Prisma } from "../../generated/prisma/client.js";
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
