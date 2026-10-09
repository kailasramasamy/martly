import { SortSheet } from "./SortSheet";
import { QuantitySheet } from "./QuantitySheet";
import { FilterSheet } from "./FilterSheet";
import type { SearchFilters } from "../../lib/use-product-search";
import type { SearchFacets } from "../../lib/types";

export type SheetName = "filters" | "sort" | "quantity";

interface SearchSheetsProps {
  sheet: SheetName | null;
  onClose: () => void;
  facets: SearchFacets | null;
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
}

export function SearchSheets({ sheet, onClose, facets, filters, onChange }: SearchSheetsProps) {
  return (
    <>
      <FilterSheet
        visible={sheet === "filters"}
        brands={facets?.brands ?? []}
        value={{ brandIds: filters.brandIds, foodType: filters.foodType }}
        onApply={onChange}
        onClose={onClose}
      />
      <SortSheet visible={sheet === "sort"} selected={filters.sortBy} onSelect={(sortBy) => onChange({ sortBy })} onClose={onClose} />
      <QuantitySheet visible={sheet === "quantity"} sizes={facets?.sizes ?? []} selected={filters.size} onSelect={(size) => onChange({ size })} onClose={onClose} />
    </>
  );
}
