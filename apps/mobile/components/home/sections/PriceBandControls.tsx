import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PriceBandChip } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";
import { useStrings } from "../../../lib/i18n/use-strings";

const CHIP_ART = 44;

/** The warm panel the deals controls sit on, on Home and on the Deals screen */
export const DEALS_PANEL = "#fef6dc";

interface BandsProps {
  labels: string[];
  selected: number;
  onSelect: (index: number) => void;
}

/** The price bands as one segmented track, the picked band filled amber: the block's headline control */
export const BandSelector = memo(function BandSelector({ labels, selected, onSelect }: BandsProps) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {labels.map((label, i) => (
        <Pressable
          key={label}
          onPress={() => onSelect(i)}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === selected }}
          style={[styles.band, i === selected && styles.bandOn]}
        >
          <Text style={[styles.bandText, i === selected && styles.bandTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

interface ChipsProps {
  chips: PriceBandChip[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
}

function Chip({ label, imageUrl, selected, onPress }: { label: string; imageUrl: string | null; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={styles.chip}>
      <View style={[styles.chipArt, selected && styles.chipArtOn]}>
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={styles.chipImage} resizeMode="cover" />
          : <Ionicons name="apps" size={20} color={colors.primary} />}
      </View>
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

/** Category chips that narrow the band's products; "All" leads */
export const CategoryChips = memo(function CategoryChips({ chips, selectedId, onSelect }: ChipsProps) {
  const { language } = useLanguage();
  const t = useStrings("home");
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <Chip label={t.all} imageUrl={null} selected={selectedId === null} onPress={() => onSelect(null)} />
      {chips.map((chip) => (
        <Chip
          key={chip.categoryId}
          label={(language && chip.translations?.[language]?.name) || chip.label}
          imageUrl={chip.imageUrl}
          selected={chip.categoryId === selectedId}
          onPress={() => onSelect(chip.categoryId)}
        />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  track: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 14, padding: 4, gap: 4, borderRadius: 14, backgroundColor: "#ffffff",
    shadowColor: "#78350f", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  band: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderRadius: 10 },
  bandOn: { backgroundColor: colors.accent },
  bandText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  bandTextOn: { fontFamily: fonts.extrabold, color: colors.accentText },
  chips: { paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  chip: { width: 60, minHeight: 44, alignItems: "center", gap: 4 },
  chipArt: {
    width: CHIP_ART, height: CHIP_ART, borderRadius: CHIP_ART / 2, overflow: "hidden",
    alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#ffffff",
  },
  chipArtOn: { borderColor: colors.accentText },
  chipImage: { width: "100%", height: "100%" },
  chipLabel: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: colors.textSecondary, textAlign: "center" },
  chipLabelOn: { fontFamily: fonts.extrabold, color: colors.accentText },
});
