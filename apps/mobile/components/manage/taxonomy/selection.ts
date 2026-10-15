import type { DepartmentNode, TaxonomySelection } from "./types";
import { EMPTY_SELECTION } from "./types";

/** Resolve a subcategory id to its department → category → subcategory chain */
export function selectionForSubcategory(tree: DepartmentNode[], subcategoryId: string | null | undefined): TaxonomySelection {
  if (!subcategoryId) return EMPTY_SELECTION;
  for (const dept of tree) {
    for (const cat of dept.categories) {
      if (cat.subcategories.some((s) => s.id === subcategoryId)) {
        return { departmentId: dept.id, categoryId: cat.id, subcategoryId };
      }
    }
  }
  return EMPTY_SELECTION;
}

/** The most specific level chosen, in the form the products API filters accept */
export function selectionFilter(sel: TaxonomySelection): Record<string, string> {
  if (sel.subcategoryId) return { subcategoryId: sel.subcategoryId };
  if (sel.categoryId) return { categoryId: sel.categoryId };
  if (sel.departmentId) return { departmentId: sel.departmentId };
  return {};
}

export function describeSelection(tree: DepartmentNode[], sel: TaxonomySelection): string {
  const dept = tree.find((d) => d.id === sel.departmentId);
  const cat = dept?.categories.find((c) => c.id === sel.categoryId);
  const sub = cat?.subcategories.find((s) => s.id === sel.subcategoryId);
  return [dept?.name, cat?.name, sub?.name].filter(Boolean).join(" › ");
}
