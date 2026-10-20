import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { colors, fonts, spacing } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { SearchFacets } from "../../lib/types";

const FOOD_TYPES = ["VEG", "NON_VEG", "VEGAN", "EGG"] as const;

export interface FilterSelection {
  brandIds: string[];
  foodType: string | null;
}

interface FilterSheetProps {
  visible: boolean;
  // The Brand pill opens the same sheet narrowed to brands
  brandsOnly?: boolean;
  brands: SearchFacets["brands"];
  value: FilterSelection;
  onApply: (value: FilterSelection) => void;
  onClose: () => void;
}

function FoodTypeChips({ selected, onChange }: { selected: string | null; onChange: (id: string | null) => void }) {
  const t = useStrings("search");
  return (
    <View>
      <Text style={styles.section}>{t.foodType}</Text>
      <View style={styles.chips}>
        {FOOD_TYPES.map((f) => {
          const active = selected === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(active ? null : f)}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.foodTypes[f]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function FilterSheet({ visible, brandsOnly = false, brands, value, onApply, onClose }: FilterSheetProps) {
  const t = useStrings("search");
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (visible) setDraft(value); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBrand = (id: string) =>
    setDraft((d) => ({ ...d, brandIds: d.brandIds.includes(id) ? d.brandIds.filter((b) => b !== id) : [...d.brandIds, id] }));

  const footer = (
    <View style={styles.footer}>
      <TouchableOpacity style={styles.clearBtn} onPress={() => setDraft((d) => ({ brandIds: [], foodType: brandsOnly ? d.foodType : null }))}>
        <Text style={styles.clearText}>{t.clearAll}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
        <Text style={styles.applyText}>{t.apply}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet flush visible={visible} title={brandsOnly ? t.brand : t.filters} onClose={onClose} footer={footer}>
      <FlatList keyboardDismissMode="on-drag"
        data={brands}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={brands.length > 0 && !brandsOnly ? <Text style={styles.section}>{t.brands}</Text> : null}
        ListFooterComponent={brandsOnly ? null : <FoodTypeChips selected={draft.foodType} onChange={(foodType) => setDraft((d) => ({ ...d, foodType }))} />}
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
