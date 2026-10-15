import type { BrandRecord } from "./brand-types";

export interface BrandFormValues {
  name: string;
  slug: string;
  imageUrl: string | null;
  themeColor: string;
  themeColorSecondary: string;
  popularity: string;
}

export const emptyBrandForm = (): BrandFormValues => ({ name: "", slug: "", imageUrl: null, themeColor: "", themeColorSecondary: "", popularity: "" });

export function brandToForm(b: BrandRecord): BrandFormValues {
  return {
    name: b.name, slug: b.slug, imageUrl: b.imageUrl,
    themeColor: b.themeColor ?? "", themeColorSecondary: b.themeColorSecondary ?? "", popularity: String(b.popularity),
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function brandFormError(v: BrandFormValues): string | null {
  if (!v.name.trim()) return "Name is required";
  if (!/^[a-z0-9-]+$/.test(v.slug)) return "Slug may only use lowercase letters, numbers and dashes";
  if (v.themeColor && !HEX.test(v.themeColor)) return "Brand colour must look like #0d9488";
  if (v.themeColorSecondary && !HEX.test(v.themeColorSecondary)) return "Accent colour must look like #0d9488";
  if (v.popularity !== "" && !(Number.isInteger(Number(v.popularity)) && Number(v.popularity) >= 0 && Number(v.popularity) <= 100)) {
    return "Popularity is a whole number from 0 to 100";
  }
  return null;
}

/** Update accepts null to clear; create only takes values that are set */
export function brandPayload(v: BrandFormValues, creating: boolean) {
  const clear = <T,>(value: T | ""): T | null | undefined => (value === "" ? (creating ? undefined : null) : value);
  return {
    name: v.name.trim(),
    slug: v.slug,
    imageUrl: creating ? v.imageUrl ?? undefined : v.imageUrl,
    themeColor: clear(v.themeColor),
    themeColorSecondary: clear(v.themeColorSecondary),
    ...(v.popularity !== "" && { popularity: Number(v.popularity) }),
  };
}
