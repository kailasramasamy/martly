import { useState } from "react";
import type { FilterChip } from "../ui/FilterChipBar";
import type { Facet, SearchFacetsMeta } from "../ui/FacetChips";
import type { SelectOption } from "../ui/OptionSheet";
import { describeSelection, selectionFilter, selectionForSubcategory } from "../taxonomy/selection";
import { EMPTY_SELECTION, type DepartmentNode } from "../taxonomy/types";
import { CATALOG_OPTIONS, NO_FILTERS, type ProductFilters } from "./ProductFilterSheet";
import type { CatalogFilter } from "./types";

type Picker = "catalog" | "category" | "brand";

interface FilterChipsInput {
  filters: ProductFilters;
  setFilters: (next: ProductFilters) => void;
  tree: DepartmentNode[];
  brandOptions: SelectOption[];
  /** Breakdown of the current results; category picks from it only while searching (else the full tree) */
  facets: SearchFacetsMeta["facets"];
  searching: boolean;
  /** The list is fixed to one subcategory, so there's no category chip */
  lockCategory?: boolean;
  onOpenAll: () => void;
}

export interface ChipPicker {
  title: string;
  options: SelectOption[];
  value: string;
  onPick: (value: string) => void;
}

/** Search-result breakdown as sheet options, led by an "All …" reset carrying the total */
function facetOptions(facets: Facet[], allLabel: string): SelectOption[] {
  const total = facets.reduce((sum, f) => sum + f.count, 0);
  return [{ value: "", label: allLabel, count: total }, ...facets.map((f) => ({ value: f.id, label: f.name, count: f.count }))];
}

export function activeFilterCount(f: ProductFilters): number {
  return (f.catalog !== "all" ? 1 : 0) + Object.keys(selectionFilter(f.selection)).length + (f.brandId ? 1 : 0);
}

/** Names of the picked category and brand; facets cover ids a still-loading tree or brand list doesn't know yet */
function pickedNames(filters: ProductFilters, tree: DepartmentNode[], brandOptions: SelectOption[], subFacets: Facet[], brandFacets: Facet[]) {
  const categoryName = describeSelection(tree, filters.selection).split(" › ").pop()
    || subFacets.find((f) => f.id === filters.selection.subcategoryId)?.name;
  const brandName = filters.brandId ? brandOptions.find((o) => o.value === filters.brandId)?.label
    ?? brandFacets.find((f) => f.id === filters.brandId)?.name : undefined;
  return { categoryName: categoryName || undefined, brandName };
}

/** Dropdown chips for the product list; brand (and, while searching, category) list the results' own breakdown */
export function useFilterChips({ filters, setFilters, tree, brandOptions, facets, searching, lockCategory, onOpenAll }: FilterChipsInput) {
  // The last picker stays mounted while its sheet slides away
  const [which, setWhich] = useState<Picker>("catalog");
  const [visible, setVisible] = useState(false);
  const show = (p: Picker) => {
    setWhich(p);
    setVisible(true);
  };
  const subFacets = facets?.subcategories ?? [];
  const brandFacets = facets?.brands ?? [];
  const set = (patch: Partial<ProductFilters>) => {
    setFilters({ ...filters, ...patch });
    setVisible(false);
  };

  const { categoryName, brandName } = pickedNames(filters, tree, brandOptions, subFacets, brandFacets);

  const pickers: Record<Picker, ChipPicker> = {
    catalog: { title: "Catalog", options: CATALOG_OPTIONS, value: filters.catalog, onPick: (v) => set({ catalog: v as CatalogFilter }) },
    category: {
      title: "Category",
      options: facetOptions(subFacets, "All categories"),
      value: filters.selection.subcategoryId,
      // Facet ids may be missing from a still-loading tree; the subcategory alone is enough to filter on
      onPick: (v) => set({ selection: v ? { ...selectionForSubcategory(tree, v), subcategoryId: v } : EMPTY_SELECTION }),
    },
    brand: {
      title: "Brand",
      options: brandFacets.length > 0 ? facetOptions(brandFacets, "All brands") : brandOptions.map((o) => (o.value ? o : { ...o, label: "All brands" })),
      value: filters.brandId,
      onPick: (v) => set({ brandId: v }),
    },
  };

  const chips: FilterChip[] = [
    { key: "catalog", label: "Catalog", value: filters.catalog === "all" ? undefined : CATALOG_OPTIONS.find((o) => o.value === filters.catalog)?.label, onPress: () => show("catalog") },
    ...(lockCategory ? [] : [{
      key: "category", label: "Category", value: categoryName,
      onPress: () => (searching && subFacets.length > 1 ? show("category") : onOpenAll()),
    }]),
    { key: "brand", label: "Brand", value: brandName, onPress: () => show("brand") },
  ];

  return {
    chips,
    activeCount: activeFilterCount(filters),
    clear: () => setFilters(NO_FILTERS),
    picker: { ...pickers[which], visible },
    closePicker: () => setVisible(false),
  };
}
