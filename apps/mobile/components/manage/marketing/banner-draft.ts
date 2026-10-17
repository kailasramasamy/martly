import { BannerPlacementLabels } from "@martly/shared/constants";
import type { PromoBanner } from "@martly/shared/types";
import type { TaxonomyLevel } from "./taxonomy";

export const PLACEMENT_OPTIONS = Object.entries(BannerPlacementLabels).map(([value, label]) => ({ value, label }));
export const MAX_BANNERS = 6;

/** A banner as edited in a form, before it is saved */
export interface BannerDraft {
  key: string;
  placement: string | null;
  imageUrl: string | null;
  textInImage: boolean;
  title: string;
  subtitle: string;
  storeId: string;
  /** "level:id" of the aisle, for category-page placements */
  taxonomy: string | null;
}

export interface DraftErrors {
  placement?: string;
  imageUrl?: string;
}

let counter = 0;
export const emptyDraft = (): BannerDraft => ({
  key: `draft-${counter++}`, placement: null, imageUrl: null, textInImage: false, title: "", subtitle: "", storeId: "", taxonomy: null,
});

export function draftFromBanner(b: PromoBanner): BannerDraft {
  const level: TaxonomyLevel | null = b.subcategoryId ? "subcategoryId" : b.categoryId ? "categoryId" : b.departmentId ? "departmentId" : null;
  return {
    key: b.id, placement: b.placement, imageUrl: b.imageUrl, textInImage: b.textInImage, title: b.title, subtitle: b.subtitle ?? "",
    storeId: b.storeId ?? "", taxonomy: level ? `${level}:${b[level]}` : null,
  };
}

export function validateDraft(d: BannerDraft): DraftErrors {
  return { placement: d.placement ? undefined : "Choose a placement", imageUrl: d.imageUrl ? undefined : "Banner image is required" };
}

export const hasErrors = (e: object) => Object.values(e).some(Boolean);

/** Create sends only what is set; update sends nulls so cleared fields are cleared on the server */
export function draftPayload(d: BannerDraft, update: boolean) {
  const tax = d.taxonomy && d.placement === "CATEGORY_TOP" ? d.taxonomy.split(":") : null;
  const empty = update ? null : undefined;
  const aisle = (level: TaxonomyLevel) => (tax?.[0] === level ? tax[1] : empty);
  return {
    placement: d.placement,
    imageUrl: d.imageUrl,
    textInImage: d.textInImage,
    title: d.title.trim() || undefined,
    subtitle: d.subtitle.trim() || empty,
    storeId: d.storeId || empty,
    departmentId: aisle("departmentId"),
    categoryId: aisle("categoryId"),
    subcategoryId: aisle("subcategoryId"),
  };
}
