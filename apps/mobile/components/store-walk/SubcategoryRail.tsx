import { useEffect, useRef } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { WalkAisle } from "../../lib/types";

type Subcategory = WalkAisle["subcategories"][number];

// Each tag hangs a little askew from the rail
const TILTS = ["-2.5deg", "1.5deg", "-1deg", "2deg"];
const TILE = 76;
const GAP = 8;
const PADDING = 16;

// A paper tag on a string: punched hole, the section's picture and name. The picked one is the store's teal
function Tile({ label, imageUrl, active, onPress, i }: { label: string; imageUrl: string | null; active: boolean; onPress: () => void; i: number }) {
  return (
    <TouchableOpacity
      style={[styles.tile, { transform: [{ rotate: TILTS[i % TILTS.length] }] }]} onPress={onPress} activeOpacity={0.8}
      accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label}
    >
      <View style={styles.string} />
      <View style={[styles.tag, active && styles.tagActive]}>
        <View style={styles.hole} />
        <View style={styles.picture}>
          {imageUrl
            ? <Image source={{ uri: imageUrl }} style={styles.image} />
            : <Ionicons name="grid-outline" size={20} color={colors.primary} />}
        </View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  subcategories: Subcategory[];
  allImage: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Straight under the wall (no due items between), so it can tuck up into the wall's fade */
  raised: boolean;
}

/** The aisle's sections as tags hanging from a rail: "All" first, then each subcategory with its picture */
export function SubcategoryRail({ subcategories, allImage, selected, onSelect, raised }: Props) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const { width } = useWindowDimensions();
  const rail = useRef<ScrollView>(null);
  // The picked tag comes to the middle, so its name is never cut off at the screen's edge ("All" is the first tag)
  const index = subcategories.findIndex((sc) => sc.id === selected) + 1;
  useEffect(() => {
    rail.current?.scrollTo({ x: Math.max(0, PADDING + index * (TILE + GAP) - (width - TILE) / 2), animated: true });
  }, [index, width]);
  if (subcategories.length < 2) return null;
  return (
    <ScrollView ref={rail} horizontal showsHorizontalScrollIndicator={false} style={[styles.rail, raised && styles.raised]} contentContainerStyle={styles.content}>
      <View style={styles.bar} />
      <Tile label={t.allInAisle} imageUrl={allImage} active={selected === null} onPress={() => onSelect(null)} i={0} />
      {subcategories.map((sc, i) => (
        <Tile key={sc.id} label={getLocalizedName(sc)} imageUrl={sc.imageUrl} active={selected === sc.id} onPress={() => onSelect(sc.id)} i={i + 1} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { marginHorizontal: -16 },
  // Pulled up into the wall's fade, so the tags hang just under the aisle boards
  raised: { marginTop: -48 },
  content: { gap: GAP, paddingHorizontal: PADDING, paddingBottom: 4 },
  // The metal rail the tags hang from, running the length of the row
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: "#94a3b8" },
  tile: { width: TILE, alignItems: "center", transformOrigin: "top" },
  string: { width: 1.5, height: 8, backgroundColor: "#64748b" },
  tag: {
    width: TILE, paddingTop: 9, paddingBottom: 5, paddingHorizontal: 4, borderRadius: 8, alignItems: "center", gap: 3,
    backgroundColor: "#fffdf5", borderWidth: 1, borderColor: "#e9dfc4",
    shadowColor: "#0f172a", shadowOpacity: 0.14, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  tagActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  hole: { position: "absolute", top: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: "#cbd5e1" },
  picture: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", padding: 4 },
  image: { width: "100%", height: "100%", resizeMode: "contain" },
  label: { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 13, color: colors.text, textAlign: "center" },
  labelActive: { color: "#ffffff" },
});
