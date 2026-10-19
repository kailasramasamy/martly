import { memo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { CampaignTile } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";

interface Props {
  aisles: CampaignTile[];
  /** The selected aisle's subcategory ids (comma-separated), or undefined for everything */
  selected: string | undefined;
  onSelect: (subcategoryIds: string | undefined) => void;
  /** Selected chip fill: the campaign's ink, or the brand colour on a plain collection */
  accent: string;
}

/** "All" plus each aisle of the collection, with a pack and its item count; picking one narrows the products to it */
export const AisleChips = memo(function AisleChips({ aisles, selected, onSelect, accent }: Props) {
  const chip = (key: string, label: string, value: string | undefined, image?: string, count?: number) => {
    const active = selected === value;
    return (
      <Pressable
        key={key}
        onPress={() => onSelect(value)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [styles.chip, active && { backgroundColor: accent, borderColor: accent }, pressed && styles.pressed]}
      >
        {image ? <Image source={{ uri: image }} style={styles.thumb} resizeMode="contain" /> : null}
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{label}</Text>
        {count != null ? <Text style={[styles.count, active && styles.labelActive]}>{count}</Text> : null}
      </Pressable>
    );
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {chip("all", "All", undefined)}
      {aisles.map((a) => chip(a.id, a.label, a.subcategoryIds.join(","), a.images[0], a.productCount))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  // Runs edge to edge through the grid's side padding
  scroll: { marginHorizontal: -16, marginBottom: 14 },
  row: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: "#ffffff",
  },
  pressed: { opacity: 0.85 },
  thumb: { width: 24, height: 24, borderRadius: 6 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  labelActive: { color: "#ffffff" },
});
