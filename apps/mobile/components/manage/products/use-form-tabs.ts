import { useState } from "react";
import type { SegmentOption } from "../ui/SegmentedTabs";
import type { ProductFormErrors } from "./validate";

export type FormTab = "basic" | "photos" | "sizes" | "details" | "compliance" | "translations" | "stores";

const TABS: { value: FormTab; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "photos", label: "Photos" },
  { value: "sizes", label: "Sizes" },
  { value: "details", label: "Details" },
  { value: "compliance", label: "Compliance" },
  { value: "translations", label: "Translations" },
  { value: "stores", label: "Stores" },
];

function errorCounts(errors: ProductFormErrors): Partial<Record<FormTab, number>> {
  return {
    basic: errors.name ? 1 : 0,
    sizes: Object.keys(errors.variants).length,
    details: errors.nutritionalInfo ? 1 : 0,
  };
}

/** Section tabs for the product form; each tab carries a count of its validation errors */
export function useFormTabs(errors: ProductFormErrors, withStores: boolean) {
  const [tab, setTab] = useState<FormTab>("basic");
  const counts = errorCounts(errors);
  const options: SegmentOption<FormTab>[] = TABS
    .filter((t) => withStores || t.value !== "stores")
    .map((t) => ({ ...t, count: counts[t.value] }));

  /** Opens the first tab with an error, if any */
  const showFirstError = (found: ProductFormErrors) => {
    const next = TABS.find((t) => (errorCounts(found)[t.value] ?? 0) > 0);
    if (next) setTab(next.value);
  };

  return { tab, setTab, options, showFirstError };
}
