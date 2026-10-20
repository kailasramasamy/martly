import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { FestiveAisle } from "../../lib/types";

// Catalog names carry asides ("Agarbatti (Incense Sticks)"); a pill only needs the name itself
const ASIDE = /\s*\(.*\)\s*$/;

interface Props {
  aisles: FestiveAisle[];
  selectedId: string | null;
  ink: string;
  onSelect: (id: string | null) => void;
}

interface PillProps {
  label: string;
  selected: boolean;
  ink: string;
  onPress: () => void;
  children: ReactNode;
}

function Pill({ label, selected, ink, onPress, children }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.pill, selected && { borderColor: ink, backgroundColor: `${ink}12` }]}
    >
      <View style={styles.thumb}>{children}</View>
      <Text style={[styles.label, selected && { color: ink, fontFamily: fonts.bold }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Narrows a tile's mixed shelf to one of its aisles; hidden when the tile has only one. */
export function AislePills({ aisles, selectedId, ink, onSelect }: Props) {
  const { language } = useLanguage();
  const t = useStrings("home");
  if (aisles.length < 2) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar} contentContainerStyle={styles.rail}>
      <Pill label={t.all} selected={selectedId === null} ink={ink} onPress={() => onSelect(null)}>
        <Ionicons name="grid-outline" size={15} color={selectedId === null ? ink : colors.textSecondary} />
      </Pill>
      {aisles.map((aisle) => {
        const name = ((language && aisle.translations?.[language]?.name) || aisle.name).replace(ASIDE, "");
        return (
          <Pill key={aisle.id} label={name} selected={aisle.id === selectedId} ink={ink} onPress={() => onSelect(aisle.id)}>
            {aisle.imageUrl
              ? <Image source={{ uri: aisle.imageUrl }} style={styles.thumbImage} />
              : <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />}
          </Pill>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The shelf below takes the remaining height; without this the bar is squeezed and clips the pills
  bar: { flexGrow: 0, flexShrink: 0 },
  rail: { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingLeft: 5, paddingRight: 14,
    borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  thumb: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  thumbImage: { width: 32, height: 32 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
