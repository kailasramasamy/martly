import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { SelectField, type SelectOption } from "../ui/SelectField";
import { TaxonomyPicker } from "../taxonomy/TaxonomyPicker";
import { EMPTY_SELECTION, type DepartmentNode, type TaxonomySelection } from "../taxonomy/types";

export interface ProductFilters {
  selection: TaxonomySelection;
  brandId: string;
}

export const NO_FILTERS: ProductFilters = { selection: EMPTY_SELECTION, brandId: "" };

interface ProductFilterSheetProps {
  visible: boolean;
  value: ProductFilters;
  tree: DepartmentNode[];
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
    <BottomSheet visible={visible} title="Filter products" onClose={onClose} footer={footer}>
      <View style={styles.body}>
        <TaxonomyPicker allowAny tree={tree} value={draft.selection} onChange={(selection) => setDraft({ ...draft, selection })} />
        <SelectField label="Brand" value={draft.brandId} options={options} onChange={(brandId) => setDraft({ ...draft, brandId })} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 8 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 8 },
  flex: { flex: 1 },
  apply: { flex: 2 },
});
