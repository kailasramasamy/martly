import { pathTo, type CascaderOption } from "../../banners/category-target";

export interface BannerFormValues {
  placement: string;
  imageUrl: string;
  textInImage: boolean;
  title?: string;
  subtitle?: string;
  storeId?: string;
  aislePath?: string[];
}

export interface BannerRecord {
  id: string;
  placement: string;
  imageUrl: string;
  textInImage: boolean;
  title: string;
  subtitle: string | null;
  storeId: string | null;
  departmentId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
}

/** The aisle picker holds a path; the API wants the id at the matching depth */
export function toBannerBody(values: BannerFormValues) {
  const aisle = values.placement === "CATEGORY_TOP" ? values.aislePath ?? [] : [];
  return {
    placement: values.placement,
    imageUrl: values.imageUrl,
    textInImage: values.textInImage,
    title: values.title?.trim() || undefined,
    subtitle: values.subtitle?.trim() || undefined,
    storeId: values.storeId ?? null,
    departmentId: aisle.length === 1 ? aisle[0] : null,
    categoryId: aisle.length === 2 ? aisle[1] : null,
    subcategoryId: aisle.length === 3 ? aisle[2] : null,
  };
}

/** The form values for editing a saved banner */
export function toBannerFormValues(banner: BannerRecord, tree: CascaderOption[]): BannerFormValues {
  const aisleId = banner.subcategoryId ?? banner.categoryId ?? banner.departmentId;
  return {
    placement: banner.placement,
    imageUrl: banner.imageUrl,
    textInImage: banner.textInImage,
    title: banner.title,
    subtitle: banner.subtitle ?? undefined,
    storeId: banner.storeId ?? undefined,
    aislePath: (aisleId && pathTo(tree, aisleId)) || undefined,
  };
}
