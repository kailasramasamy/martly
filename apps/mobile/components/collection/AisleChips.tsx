import { memo, useCallback, useEffect, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, type LayoutRectangle } from "react-native";
import type { CampaignTile } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useTileLabel } from "../home/sections/TileGridParts";

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
  const t = useStrings("home");
  const labelOf = useTileLabel();
  // Where each chip sits in the row, so the selected one can be scrolled to the middle of what's visible
  const scrollRef = useRef<ScrollView>(null);
  const viewWidth = useRef(0);
  const chips = useRef(new Map<string | undefined, LayoutRectangle>());

  const reveal = useCallback((value: string | undefined) => {
    const box = chips.current.get(value);
    if (!box || !viewWidth.current) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, box.x - (viewWidth.current - box.width) / 2), animated: true });
  }, []);

  useEffect(() => reveal(selected), [selected, reveal]);

  const chip = (key: string, label: string, value: string | undefined, image?: string, count?: number) => {
    const active = selected === value;
    return (
      <Pressable
        key={key}
        onLayout={(e) => {
          chips.current.set(value, e.nativeEvent.layout);
          // A selection made before the row laid out (opened from a Home aisle tile) is revealed once its chip lands
          if (active) reveal(value);
        }}
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
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
      onLayout={(e) => { viewWidth.current = e.nativeEvent.layout.width; reveal(selected); }}
    >
      {chip("all", t.all, undefined)}
      {aisles.map((a) => chip(a.id, labelOf(a), a.subcategoryIds.join(","), a.images[0], a.productCount))}
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
