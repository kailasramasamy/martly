export type TaxonomyLevel = "department" | "category" | "subcategory";

export interface SubcategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  subcategories: SubcategoryNode[];
}

export interface DepartmentNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  categories: CategoryNode[];
}

/** Chained picker state; "" means not chosen */
export interface TaxonomySelection {
  departmentId: string;
  categoryId: string;
  subcategoryId: string;
}

export const EMPTY_SELECTION: TaxonomySelection = { departmentId: "", categoryId: "", subcategoryId: "" };
