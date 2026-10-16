import { useEffect, useState } from "react";
import type { CatalogDraftDetail } from "@martly/shared/types";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { normalizeUnitType } from "../products/options";
import { useTaxonomy } from "../taxonomy/use-taxonomy";
import { selectionForSubcategory } from "../taxonomy/selection";
import { EMPTY_SELECTION, type TaxonomySelection } from "../taxonomy/types";
import { sizeError, toSizePayload, type SizeValues } from "./sizes";

export const NEW_BRAND = "__new__";

export interface ReviewValues {
  name: string;
  description: string;
  variantName: string;
  unitType: string;
  unitValue: string;
  foodType: string;
  mrp: string;
  sellingPrice: string;
  stock: string;
  /** Existing brand id, NEW_BRAND, or "" for none */
  brand: string;
  newBrandName: string;
  selection: TaxonomySelection;
  extraSizes: SizeValues[];
}

function initialValues(d: CatalogDraftDetail): ReviewValues {
  const label = d.label;
  return {
    name: d.name ?? label?.name ?? "",
    description: label?.description ?? "",
    variantName: d.variantName ?? label?.variantName ?? "",
    unitType: label ? normalizeUnitType(label.unitType) : "",
    unitValue: label ? String(label.unitValue) : "",
    foodType: label?.foodType ?? "",
    mrp: String(d.mrp),
    sellingPrice: String(d.sellingPrice),
    stock: String(d.stock),
    brand: d.brand?.id ?? (label?.brand ? NEW_BRAND : ""),
    newBrandName: label?.brand ?? "",
    selection: EMPTY_SELECTION,
    extraSizes: [],
  };
}

/** Only fields with a value are sent; the API keeps the agent's reading for anything left out */
export function toApprovePayload(v: ReviewValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: v.name.trim() || undefined,
    description: v.description.trim() || undefined,
    variantName: v.variantName.trim() || undefined,
    unitType: v.unitType || undefined,
    unitValue: Number(v.unitValue) > 0 ? Number(v.unitValue) : undefined,
    foodType: v.foodType || undefined,
    mrp: Number(v.mrp) > 0 ? Number(v.mrp) : undefined,
    sellingPrice: Number(v.sellingPrice) > 0 ? Number(v.sellingPrice) : undefined,
    stock: v.stock.trim() === "" ? undefined : Number(v.stock),
    subcategoryId: v.selection.subcategoryId || undefined,
    extraSizes: v.extraSizes.length ? v.extraSizes.map(toSizePayload) : undefined,
  };
  if (v.brand === NEW_BRAND) payload.newBrandName = v.newBrandName.trim() || undefined;
  else if (v.brand) payload.brandId = v.brand;
  return payload;
}

export function useReviewForm(draft: CatalogDraftDetail, onDone: (next: CatalogDraftDetail) => void) {
  const { tree } = useTaxonomy();
  const [values, setValues] = useState(() => initialValues(draft));
  const { run, running } = useAction();
  const toast = useToast();
  const [showSizeErrors, setShowSizeErrors] = useState(false);
  const aiSubcategoryId = draft.subcategory?.id;

  useEffect(() => {
    if (tree.length === 0 || !aiSubcategoryId) return;
    setValues((prev) => (prev.selection.subcategoryId ? prev : { ...prev, selection: selectionForSubcategory(tree, aiSubcategoryId) }));
  }, [tree, aiSubcategoryId]);

  const patch = (next: Partial<ReviewValues>) => setValues((prev) => ({ ...prev, ...next }));

  const approve = async () => {
    if (values.extraSizes.some((s) => sizeError(s))) {
      setShowSizeErrors(true);
      toast.show("Finish or remove the extra sizes first", "error");
      return;
    }
    const next = await run(
      () => api.post<CatalogDraftDetail>(`/api/v1/catalog-drafts/${draft.id}/approve`, toApprovePayload(values)).then((r) => r.data),
      "Published to the store",
    );
    if (next) onDone(next);
  };

  return { values, patch, tree, approve, approving: running, showSizeErrors };
}
