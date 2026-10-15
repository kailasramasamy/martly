import type { TaxonomyLevel } from "./types";

const BASE = "/api/v1/categories";

/** Collection endpoint for a level; append `/${id}` for one record */
export function levelPath(level: TaxonomyLevel): string {
  if (level === "department") return `${BASE}/departments`;
  if (level === "subcategory") return `${BASE}/subcategories`;
  return BASE;
}

export const LEVEL_LABEL: Record<TaxonomyLevel, string> = {
  department: "Department",
  category: "Category",
  subcategory: "Subcategory",
};

export const CHILD_LEVEL: Partial<Record<TaxonomyLevel, TaxonomyLevel>> = {
  department: "category",
  category: "subcategory",
};

export function isTaxonomyLevel(value: string | undefined): value is TaxonomyLevel {
  return value === "department" || value === "category" || value === "subcategory";
}
