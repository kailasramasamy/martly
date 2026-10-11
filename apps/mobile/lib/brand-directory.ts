import type { DirectoryBrand, DirectoryCategory, DirectoryDepartment } from "@martly/shared/types";

export const TILES_PER_ROW = 3;
// Rows shown per category before "View all"
const COLLAPSED_ROWS = 3;

// The flat rows of the brands screen, rendered by one FlatList (index 0 = header, index 1 = sticky chips)
export type DirectoryItem =
  | { type: "header"; key: string }
  | { type: "chips"; key: string }
  | { type: "department"; key: string; department: DirectoryDepartment; brandCount: number }
  | { type: "category"; key: string; category: DirectoryCategory; departmentName: string; brandCount: number }
  | { type: "row"; key: string; brands: DirectoryBrand[] }
  | { type: "more"; key: string; categoryId: string; hidden: number }
  | { type: "empty"; key: string };

interface BuildOptions {
  departmentId: string | null;
  query: string;
  expanded: Set<string>;
}

export const distinctBrands = (categories: DirectoryCategory[]) => new Set(categories.flatMap((c) => c.brands.map((b) => b.id))).size;

function filterDepartments(departments: DirectoryDepartment[], { departmentId, query }: BuildOptions): DirectoryDepartment[] {
  const q = query.trim().toLowerCase();
  return departments
    .filter((d) => !departmentId || d.id === departmentId)
    .map((d) => ({
      ...d,
      categories: d.categories
        .map((c) => ({ ...c, brands: q ? c.brands.filter((b) => b.name.toLowerCase().includes(q)) : c.brands }))
        .filter((c) => c.brands.length > 0),
    }))
    .filter((d) => d.categories.length > 0);
}

function categoryItems(category: DirectoryCategory, departmentName: string, expanded: boolean): DirectoryItem[] {
  const limit = expanded ? category.brands.length : COLLAPSED_ROWS * TILES_PER_ROW;
  const shown = category.brands.slice(0, limit);
  const items: DirectoryItem[] = [{ type: "category", key: `c-${category.id}`, category, departmentName, brandCount: category.brands.length }];
  for (let i = 0; i < shown.length; i += TILES_PER_ROW) {
    items.push({ type: "row", key: `r-${category.id}-${i}`, brands: shown.slice(i, i + TILES_PER_ROW) });
  }
  if (category.brands.length > limit) items.push({ type: "more", key: `m-${category.id}`, categoryId: category.id, hidden: category.brands.length - limit });
  return items;
}

export function buildDirectoryItems(departments: DirectoryDepartment[], options: BuildOptions): DirectoryItem[] {
  const items: DirectoryItem[] = [{ type: "header", key: "header" }, { type: "chips", key: "chips" }];
  // A search lists every match, so nothing stays folded behind "View all"
  const expandAll = options.query.trim().length > 0;
  const visible = filterDepartments(departments, options);
  for (const department of visible) {
    // With one department picked the chips already name it, so its band would only repeat that
    if (!options.departmentId) items.push({ type: "department", key: `d-${department.id}`, department, brandCount: distinctBrands(department.categories) });
    for (const c of department.categories) items.push(...categoryItems(c, department.name, expandAll || options.expanded.has(c.id)));
  }
  if (visible.length === 0) items.push({ type: "empty", key: "empty" });
  return items;
}
