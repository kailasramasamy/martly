import type { CategoryNode, DepartmentNode, SubcategoryNode, TaxonomyLevel } from "./types";

export type AnyNode = DepartmentNode | CategoryNode | SubcategoryNode;

export interface FoundNode {
  node: AnyNode;
  children: AnyNode[];
  /** Id of the parent (department for a category, category for a subcategory) */
  parentId?: string;
  path: string[];
}

/** Locate a node by level and id in the cached tree, with its direct children and breadcrumb */
export function findNode(tree: DepartmentNode[], level: TaxonomyLevel, id: string): FoundNode | null {
  for (const dept of tree) {
    if (level === "department" && dept.id === id) return { node: dept, children: dept.categories, path: [dept.name] };
    for (const cat of dept.categories) {
      if (level === "category" && cat.id === id) return { node: cat, children: cat.subcategories, parentId: dept.id, path: [dept.name, cat.name] };
      const sub = level === "subcategory" ? cat.subcategories.find((s) => s.id === id) : undefined;
      if (sub) return { node: sub, children: [], parentId: cat.id, path: [dept.name, cat.name, sub.name] };
    }
  }
  return null;
}
