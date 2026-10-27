import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { ownBrandId } from "@martly/shared/constants";
import type { DirectoryDepartment } from "@martly/shared/types";
import type { BrandBoost } from "./brand-boost.js";

// Stores have no theme colour of their own yet, so their brand store wears the app's teal
const OWN_BRAND_THEME = "#0f766e";

/** What a store sells as "Our brand": its organisation's brands plus its unbranded staples */
export function ownProductWhere(boost: BrandBoost): Prisma.ProductWhereInput {
  return { OR: [{ brandId: { in: boost.ownBrandIds } }, { brandId: null, subcategoryId: { in: boost.stapleSubcategoryIds } }] };
}

/** The store as a brand: its name and logo, for the brand store screen */
export async function ownBrand(prisma: PrismaClient, storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true, logoUrl: true } });
  if (!store) return null;
  return { id: ownBrandId(storeId), name: store.name, imageUrl: store.logoUrl, themeColor: OWN_BRAND_THEME, themeColorSecondary: null };
}

/** The store's brand with its product count; null when it sells nothing as its own or doesn't promote it */
export async function ownBrandWithCount(prisma: PrismaClient, storeId: string, boost: BrandBoost) {
  if (!boost.ownBrandIds.length && !boost.stapleSubcategoryIds.length) return null;
  const [brand, productCount] = await Promise.all([
    ownBrand(prisma, storeId),
    prisma.product.count({ where: { isActive: true, storeProducts: { some: { storeId, isActive: true } }, ...ownProductWhere(boost) } }),
  ]);
  return brand && productCount ? { ...brand, productCount } : null;
}

type Translations = DirectoryDepartment["translations"];
export interface AisleCount {
  deptId: string; deptName: string; deptTranslations: Translations; deptSort: number;
  catId: string; catName: string; catTranslations: Translations; catSort: number;
  productCount: number;
}

/** How many "Our brand" products the store has in each category, for the brands directory */
export function ownBrandAisles(prisma: PrismaClient, storeId: string, boost: BrandBoost) {
  return prisma.$queryRaw<AisleCount[]>`
    SELECT d.id AS "deptId", d.name AS "deptName", d.translations AS "deptTranslations", d.sort_order AS "deptSort",
      c.id AS "catId", c.name AS "catName", c.translations AS "catTranslations", c.sort_order AS "catSort",
      COUNT(DISTINCT p.id)::int AS "productCount"
    FROM store_products sp
    JOIN products p ON p.id = sp.product_id
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id
    JOIN departments d ON d.id = c.department_id
    WHERE sp.store_id = ${storeId} AND sp.is_active = true AND p.is_active = true
      AND (p.brand_id = ANY(${boost.ownBrandIds}) OR (p.brand_id IS NULL AND s.id = ANY(${boost.stapleSubcategoryIds})))
    GROUP BY d.id, c.id`;
}
