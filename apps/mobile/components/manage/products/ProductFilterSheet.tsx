import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/SelectField";
import type { SelectOption } from "../ui/OptionSheet";
import { TaxonomyPicker } from "../taxonomy/TaxonomyPicker";
import { EMPTY_SELECTION, type DepartmentNode, type TaxonomySelection } from "../taxonomy/types";
import type { CatalogFilter } from "./types";

export const CATALOG_OPTIONS: { value: CatalogFilter; label: string }[] = [
  { value: "all", label: "All products" },
  { value: "master", label: "Master catalog" },
  { value: "org", label: "Our products" },
];

export interface ProductFilters {
  catalog: CatalogFilter;
  selection: TaxonomySelection;
  brandId: string;
}

export const NO_FILTERS: ProductFilters = { catalog: "all", selection: EMPTY_SELECTION, brandId: "" };

interface ProductFilterSheetProps {
  visible: boolean;
  value: ProductFilters;
  /** Omit to leave out the category pickers, e.g. on a subcategory's own list */
  tree?: DepartmentNode[];
  brandOptions: SelectOption[];
  onApply: (next: ProductFilters) => void;
  onClose: () => void;
}

export function ProductFilterSheet({ visible, value, tree, brandOptions, onApply, onClose }: ProductFilterSheetProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const options = brandOptions.map((o) => (o.value === "" ? { value: "", label: "All brands" } : o));
  const footer = (
    <View style={styles.footer}>
      <Button label="Clear" variant="secondary" onPress={() => onApply(NO_FILTERS)} style={styles.flex} />
      <Button label="Apply" onPress={() => onApply(draft)} style={styles.apply} />
    </View>
  );

  return (
    <BottomSheet visible={visible} title="Filters" onClose={onClose} footer={footer}>
      <View style={styles.body}>
        <SelectField label="Catalog" value={draft.catalog} options={CATALOG_OPTIONS} onChange={(catalog) => setDraft({ ...draft, catalog: catalog as CatalogFilter })} />
        {tree && <TaxonomyPicker allowAny tree={tree} value={draft.selection} onChange={(selection) => setDraft({ ...draft, selection })} />}
        <SelectField label="Brand" value={draft.brandId} options={options} onChange={(brandId) => setDraft({ ...draft, brandId })} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 4 },
  footer: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  apply: { flex: 2 },
});
