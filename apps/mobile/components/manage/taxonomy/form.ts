import type { TaxonomyLevel } from "./types";

export interface TaxonomyFormValues {
  level: TaxonomyLevel;
  departmentId: string;
  categoryId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: string;
  searchTerms: string[];
  taName: string;
}

export const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function emptyTaxonomyForm(level: TaxonomyLevel): TaxonomyFormValues {
  return { level, departmentId: "", categoryId: "", name: "", slug: "", imageUrl: null, sortOrder: "", searchTerms: [], taName: "" };
}

export interface TaxonomyRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  searchTerms?: string[];
  translations: { ta?: { name?: string } } | null;
}

export function recordToForm(level: TaxonomyLevel, r: TaxonomyRecord): TaxonomyFormValues {
  return {
    ...emptyTaxonomyForm(level),
    name: r.name, slug: r.slug, imageUrl: r.imageUrl, sortOrder: String(r.sortOrder),
    searchTerms: r.searchTerms ?? [], taName: r.translations?.ta?.name ?? "",
  };
}

export function formError(v: TaxonomyFormValues): string | null {
  if (!v.name.trim()) return "Name is required";
  if (!/^[a-z0-9-]+$/.test(v.slug)) return "Slug may only use lowercase letters, numbers and dashes";
  if (v.level === "category" && !v.departmentId) return "Choose a department";
  if (v.level === "subcategory" && !v.categoryId) return "Choose a category";
  if (v.sortOrder !== "" && !(Number.isInteger(Number(v.sortOrder)) && Number(v.sortOrder) >= 0)) return "Sort order must be a whole number";
  return null;
}

export function toPayload(v: TaxonomyFormValues, creating: boolean) {
  const ta = v.taName.trim();
  return {
    name: v.name.trim(),
    slug: v.slug,
    imageUrl: v.imageUrl,
    ...(v.sortOrder !== "" && { sortOrder: Number(v.sortOrder) }),
    ...(v.level === "subcategory" && { searchTerms: v.searchTerms }),
    ...(creating && v.level === "category" && { departmentId: v.departmentId }),
    ...(creating && v.level === "subcategory" && { categoryId: v.categoryId }),
    ...(ta && { translations: { ta: { name: ta } } }),
  };
}
