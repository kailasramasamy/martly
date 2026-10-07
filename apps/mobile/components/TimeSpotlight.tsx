import { useMemo, useState, type ReactNode } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import type { StoreProduct, TimeCategorySection } from "../lib/types";

const PERIOD_COPY: Record<string, { title: string; subtitle: string }> = {
  morning: { title: "Morning picks", subtitle: "Start your morning right" },
  afternoon: { title: "Afternoon picks", subtitle: "Quick bites and lunch staples" },
  evening: { title: "Evening picks", subtitle: "Snacks and dinner essentials" },
  night: { title: "Late-night cravings", subtitle: "Delivered while you're up" },
};

const ALL = "all";
const ALL_LIMIT = 12;

interface Props {
  sections: TimeCategorySection[];
  period: string;
  renderProducts: (products: StoreProduct[]) => ReactNode;
  onViewAll: (subcategoryId: string) => void;
}

// One rail for all time-of-day subcategories, filtered by chips (instead of one rail per subcategory)
export function TimeSpotlight({ sections, period, renderProducts, onViewAll }: Props) {
  const [selected, setSelected] = useState<string>(ALL);
  const copy = PERIOD_COPY[period] ?? PERIOD_COPY.morning;

  const products = useMemo(() => {
    if (selected !== ALL) return sections.find((s) => s.id === selected)?.products ?? [];
    // Round-robin products (not size rows) across subcategories so "All" shows variety
    const productIds = sections.map((s) => [...new Set(s.products.map((p) => p.product.id))]);
    const picked = new Set<string>();
    const maxLen = Math.max(...productIds.map((ids) => ids.length));
    for (let i = 0; i < maxLen && picked.size < ALL_LIMIT; i++) {
      for (const ids of productIds) if (ids[i] && picked.size < ALL_LIMIT) picked.add(ids[i]);
    }
    const rows = sections.flatMap((s) => s.products).filter((p) => picked.has(p.product.id));
    return rows.filter((row, i) => rows.findIndex((r) => r.id === row.id) === i);
  }, [sections, selected]);

  const chips = [{ id: ALL, name: "All" }, ...sections.map((s) => ({ id: s.id, name: s.name }))];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
        {selected !== ALL && (
          <Pressable style={styles.seeAll} onPress={() => onViewAll(selected)} hitSlop={8}>
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {chips.map((chip) => {
          const active = chip.id === selected;
          return (
            <Pressable
              key={chip.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelected(chip.id)}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {renderProducts(products)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  headerText: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center",
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  chipTextActive: { color: "#fff" },
});
