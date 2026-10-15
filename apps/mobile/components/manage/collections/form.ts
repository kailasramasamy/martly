import { toDateKey, fromDateKey } from "../ui/dates";
import type { ProductListItem } from "../products/types";
import type { CollectionDetail } from "./types";

export interface CollectionFormValues {
  title: string;
  slug: string;
  subtitle: string;
  kind: string;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: string;
  isActive: boolean;
  imageUrl: string | null;
  products: ProductListItem[];
}

export const emptyCollectionForm = (): CollectionFormValues => ({
  title: "", slug: "", subtitle: "", kind: "STANDARD", startsAt: null, endsAt: null,
  sortOrder: "", isActive: true, imageUrl: null, products: [],
});

export function collectionToForm(c: CollectionDetail): CollectionFormValues {
  return {
    title: c.title, slug: c.slug, subtitle: c.subtitle ?? "", kind: c.kind,
    startsAt: c.startsAt ? toDateKey(new Date(c.startsAt)) : null,
    endsAt: c.endsAt ? toDateKey(new Date(c.endsAt)) : null,
    sortOrder: String(c.sortOrder), isActive: c.isActive, imageUrl: c.imageUrl,
    products: c.items.map((i) => i.product),
  };
}

export function collectionFormError(v: CollectionFormValues): string | null {
  if (!v.title.trim()) return "Title is required";
  if (!/^[a-z0-9-]+$/.test(v.slug)) return "Slug may only use lowercase letters, numbers and dashes";
  if (v.sortOrder !== "" && !(Number.isInteger(Number(v.sortOrder)) && Number(v.sortOrder) >= 0)) return "Sort order must be a whole number";
  if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) return "End date must be on or after the start date";
  return null;
}

/** The API replaces the whole item list whenever productIds is sent, so it is always sent in full */
export function collectionPayload(v: CollectionFormValues, creating: boolean) {
  const subtitle = v.subtitle.trim();
  return {
    title: v.title.trim(),
    slug: v.slug,
    subtitle: subtitle || (creating ? undefined : null),
    kind: v.kind,
    startsAt: v.startsAt ? fromDateKey(v.startsAt).toISOString() : null,
    endsAt: v.endsAt ? new Date(fromDateKey(v.endsAt).getTime() + 86_399_000).toISOString() : null,
    isActive: v.isActive,
    imageUrl: v.imageUrl ?? (creating ? undefined : null),
    ...(v.sortOrder !== "" && { sortOrder: Number(v.sortOrder) }),
    productIds: v.products.map((p) => p.id),
  };
}
