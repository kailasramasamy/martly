import { useEffect, useRef } from "react";
import { View, Text, Image, FlatList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import { getCategoryIcon } from "../constants/category-icons";
import { useLanguage } from "../lib/language-context";
import type { DepartmentNode } from "../lib/types";

const IMAGE_SIZE = 68;
// Soft pastel per department (cycled) so the strip reads as distinct aisles
const TILE_COLORS = ["#fde7d3", "#e0f2fe", "#dcfce7", "#fef3c7", "#ede9fe", "#fce7f3", "#ccfbf1", "#fee2e2"];

interface Props {
  departments: DepartmentNode[];
  activeId: string | null;
  onSelect: (index: number) => void;
}

/** Horizontal department jump-bar; keeps the active department scrolled into view. */
export function DepartmentStrip({ departments, activeId, onSelect }: Props) {
  const { getLocalizedName } = useLanguage();
  const listRef = useRef<FlatList<DepartmentNode>>(null);
  const activeIndex = departments.findIndex((d) => d.id === activeId);

  useEffect(() => {
    if (activeIndex >= 0) listRef.current?.scrollToIndex({ index: activeIndex, viewPosition: 0.5, animated: true });
  }, [activeIndex]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        horizontal
        data={departments}
        keyExtractor={(d) => d.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.list}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => {
          const active = item.id === activeId;
          return (
            <Pressable
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              onPress={() => onSelect(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.imageWrap, { backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }, active && styles.imageWrapActive]}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
                ) : (
                  <Ionicons name={getCategoryIcon(item.name)} size={28} color={colors.primary} />
                )}
              </View>
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
                {getLocalizedName(item)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  list: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  tab: { width: 80, alignItems: "center" },
  pressed: { opacity: 0.8 },
  imageWrap: {
    width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 20, overflow: "hidden",
    borderWidth: 2, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },
  imageWrapActive: { borderColor: colors.primary },
  image: { width: "88%", height: "88%", mixBlendMode: "multiply" },
  label: {
    marginTop: 6, fontFamily: fonts.medium, fontSize: 12, lineHeight: 15,
    color: colors.textSecondary, textAlign: "center", letterSpacing: 0,
  },
  labelActive: { fontFamily: fonts.bold, color: colors.text },
});
