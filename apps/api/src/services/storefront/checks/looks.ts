import { STORE_BRAND_DEPARTMENT_SLUG, STOREFRONT_MIN } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import { flag, fromCount, notApplicable, type CheckContext } from "./context.js";

// Staple aisles that have loose items to sell, and how many of them the store lists something loose in
async function looseStaplesCheck({ prisma, store }: CheckContext): Promise<StorefrontCheckResult> {
  const [row] = await prisma.$queryRaw<{ available: bigint; stocked: bigint }[]>`
    SELECT COUNT(DISTINCT s.id) AS available, COUNT(DISTINCT s.id) FILTER (WHERE sp.id IS NOT NULL) AS stocked
    FROM products p
    JOIN subcategories s ON s.id = p.subcategory_id JOIN categories c ON c.id = s.category_id JOIN departments d ON d.id = c.department_id
    LEFT JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${store.id} AND sp.is_active
    WHERE d.slug = ${STORE_BRAND_DEPARTMENT_SLUG} AND p.brand_id IS NULL AND p.is_active
      AND (p.organization_id IS NULL OR p.organization_id = ${store.organizationId})`;
  const available = Number(row?.available ?? 0);
  if (!available) return notApplicable("LOOSE_STAPLES");
  return fromCount("LOOSE_STAPLES", Number(row.stocked), Math.min(available, STOREFRONT_MIN.LOOSE_STAPLE_AISLES));
}

/** Logo, cover, tagline, highlights and posters: what the store card and the top of the app show; and loose staples on the shelf */
export async function looksChecks(ctx: CheckContext) {
  const { store } = ctx;
  return [
    flag("LOGO", !!store.logoUrl),
    flag("COVER", !!store.imageUrl),
    flag("TAGLINE", !!store.tagline?.trim()),
    fromCount("HIGHLIGHTS", store.highlights.filter((h) => h.trim()).length, STOREFRONT_MIN.HIGHLIGHTS),
    flag("POSTERS", store.promoImages.length > 0),
    await looseStaplesCheck(ctx),
  ];
}
