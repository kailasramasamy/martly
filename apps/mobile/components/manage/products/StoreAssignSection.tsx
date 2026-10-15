import { Text, StyleSheet } from "react-native";
import { fonts, colors } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { SwitchRow } from "../ui/SwitchRow";
import type { ManagedStore } from "../../../lib/manage-scope-context";

interface StoreAssignSectionProps {
  stores: ManagedStore[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function StoreAssignSection({ stores, selected, onChange }: StoreAssignSectionProps) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((s) => s !== id));
  const allSelected = selected.length === stores.length;

  return (
    <SectionCard
      title={`Assign to stores (${selected.length}/${stores.length})`}
      action={{ label: allSelected ? "Clear all" : "Select all", onPress: () => onChange(allSelected ? [] : stores.map((s) => s.id)) }}
    >
      {stores.map((store) => (
        <SwitchRow key={store.id} label={store.name} description={store.address} value={selected.includes(store.id)} onValueChange={(on) => toggle(store.id, on)} />
      ))}
      <Text style={styles.hint}>Selected stores list this product at MRP with 0 stock until you set stock.</Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 4 },
});
