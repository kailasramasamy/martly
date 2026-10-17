import type { PrismaClient } from "../../generated/prisma/client.js";

export interface CatalogCoverage {
  /** Active catalog sizes this store may sell: the master catalog plus its organisation's own */
  available: number;
  listed: number;
  unlisted: number;
  /** Unlisted sizes per subcategory, for pointing the onboarding wizard at the gaps */
  unlistedBySubcategory: Record<string, number>;
}

/** How much of the catalog a store already lists, and where the gaps are */
export async function catalogCoverage(prisma: PrismaClient, storeId: string, organizationId: string): Promise<CatalogCoverage> {
  const rows = await prisma.$queryRaw<{ subcategory_id: string | null; available: number; listed: number }[]>`
    SELECT p.subcategory_id, count(*)::int AS available, count(sp.id)::int AS listed
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    LEFT JOIN store_products sp ON sp.variant_id = v.id AND sp.store_id = ${storeId}
    WHERE p.is_active AND (p.organization_id IS NULL OR p.organization_id = ${organizationId})
    GROUP BY p.subcategory_id`;
  const available = rows.reduce((n, r) => n + r.available, 0);
  const listed = rows.reduce((n, r) => n + r.listed, 0);
  const gaps = rows.filter((r) => r.subcategory_id && r.available > r.listed).map((r) => [r.subcategory_id, r.available - r.listed] as const);
  return { available, listed, unlisted: available - listed, unlistedBySubcategory: Object.fromEntries(gaps) };
}
