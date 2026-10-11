// Shared by the catalog seed scripts (generic and branded)

import type { PrismaClient, ProductType, UnitType } from "../../generated/prisma/index.js";

export type TaxonomyPath = [department: string, category: string, subcategory: string];

export const PRODUCT_TYPE: Record<string, ProductType> = {
  "Grocery & Staples": "GROCERY",
  "Gourmet & World Foods": "GROCERY",
  "Fruits & Vegetables": "FRESH_PRODUCE",
  "Meat, Fish & Eggs": "FRESH_PRODUCE",
  "Dairy": "DAIRY",
  "Beverages": "BEVERAGES",
  "Snacks & Packaged Foods": "SNACKS",
  "Bakery": "BAKERY",
  "Frozen Foods": "FROZEN",
  "Personal Care": "PERSONAL_CARE",
  "Pooja & Festivals": "HOUSEHOLD",
  "Home Care": "HOUSEHOLD",
};

const UNITS: Record<string, UnitType> = {
  g: "GRAM", kg: "KG", ml: "ML", L: "LITER",
  pc: "PIECE", pcs: "PIECE", leaves: "PIECE", mulam: "PIECE", pack: "PACK", bunch: "BUNDLE",
};

// "500g" → GRAM 500, "1L" → LITER 1, "5 pcs" → PIECE 5
export function parseSize(size: string): { unitType: UnitType; unitValue: number } {
  const m = size.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
  const unitType = m && UNITS[m[2]];
  if (!m || !unitType) throw new Error(`Unrecognised pack size "${size}"`);
  return { unitType, unitValue: Number(m[1]) };
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Finds the subcategory under an existing category, creating it (last in the category) if missing
export async function resolveSubcategory(
  prisma: PrismaClient, [dept, cat, sub]: TaxonomyPath,
): Promise<{ id: string; created: boolean }> {
  const category = await prisma.category.findFirst({ where: { name: cat, department: { name: dept } } });
  if (!category) throw new Error(`Category not found: ${dept} > ${cat}`);
  const existing = await prisma.subcategory.findFirst({ where: { name: sub, categoryId: category.id } });
  if (existing) return { id: existing.id, created: false };

  const last = await prisma.subcategory.aggregate({ where: { categoryId: category.id }, _max: { sortOrder: true } });
  const created = await prisma.subcategory.create({
    data: {
      name: sub,
      slug: `${category.slug}-${slugify(sub)}`,
      categoryId: category.id,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
  return { id: created.id, created: true };
}
