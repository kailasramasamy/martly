import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { colors, fonts, spacing } from "../../constants/theme";
import type { SearchFacets } from "../../lib/types";

const FOOD_TYPES = [
  { id: "VEG", label: "Veg" },
  { id: "NON_VEG", label: "Non-veg" },
  { id: "VEGAN", label: "Vegan" },
  { id: "EGG", label: "Egg" },
];

export interface FilterSelection {
  brandIds: string[];
  foodType: string | null;
}

interface FilterSheetProps {
  visible: boolean;
  brands: SearchFacets["brands"];
  value: FilterSelection;
  onApply: (value: FilterSelection) => void;
  onClose: () => void;
}

function FoodTypeChips({ selected, onChange }: { selected: string | null; onChange: (id: string | null) => void }) {
  return (
    <View>
      <Text style={styles.section}>Food type</Text>
      <View style={styles.chips}>
        {FOOD_TYPES.map((f) => {
          const active = selected === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(active ? null : f.id)}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function FilterSheet({ visible, brands, value, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (visible) setDraft(value); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBrand = (id: string) =>
    setDraft((d) => ({ ...d, brandIds: d.brandIds.includes(id) ? d.brandIds.filter((b) => b !== id) : [...d.brandIds, id] }));

  const footer = (
    <View style={styles.footer}>
      <TouchableOpacity style={styles.clearBtn} onPress={() => setDraft({ brandIds: [], foodType: null })}>
        <Text style={styles.clearText}>Clear all</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
        <Text style={styles.applyText}>Apply</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet visible={visible} title="Filters" onClose={onClose} footer={footer}>
      <FlatList
        data={brands}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={brands.length > 0 ? <Text style={styles.section}>Brands</Text> : null}
        ListFooterComponent={<FoodTypeChips selected={draft.foodType} onChange={(foodType) => setDraft((d) => ({ ...d, foodType }))} />}
        renderItem={({ item }) => {
          const active = draft.brandIds.includes(item.id);
          return (
            <TouchableOpacity style={styles.row} onPress={() => toggleBrand(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: active }}>
              <View style={[styles.box, active && styles.boxActive]}>
                {active && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Text style={styles.label}>{item.name}</Text>
              <Text style={styles.count}>{item.count}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: spacing.md, gap: 12 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  boxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextActive: { color: "#fff" },
  footer: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  clearBtn: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  clearText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  applyBtn: { flex: 2, minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  applyText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
});
