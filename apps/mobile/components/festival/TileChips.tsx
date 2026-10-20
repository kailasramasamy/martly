import { useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import type { FestiveTile } from "../../lib/types";

const CHIP_WIDTH = 80;
const CHIP_GAP = 8;

interface Props {
  tiles: FestiveTile[];
  selectedId: string | null;
  /** Selected chip's text and border, on its white card */
  ink: string;
  /** Unselected labels, on the festive band */
  labelColor: string;
  onSelect: (id: string) => void;
}

/** The festival's themes as a rail of illustrated chips; the selected one lifts into a card. */
export function TileChips({ tiles, selectedId, ink, labelColor, onSelect }: Props) {
  const { language } = useLanguage();
  const rail = useRef<ScrollView>(null);
  const selectedIndex = tiles.findIndex((t) => t.id === selectedId);

  const revealed = useRef(false);

  // The screen can open on a tile past the screen edge; bring it into view once the rail has laid out
  const reveal = () => {
    if (revealed.current) return;
    revealed.current = true;
    if (selectedIndex > 2) rail.current?.scrollTo({ x: (selectedIndex - 1) * (CHIP_WIDTH + CHIP_GAP), animated: false });
  };

  return (
    <ScrollView ref={rail} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} onContentSizeChange={reveal}>
      {tiles.map((tile) => {
        const selected = tile.id === selectedId;
        const title = (language && tile.translations?.[language]?.title) || tile.title;
        return (
          <Pressable
            key={tile.id}
            onPress={() => onSelect(tile.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={title}
            style={[styles.chip, selected && [styles.chipSelected, { borderColor: ink }]]}
          >
            <View style={styles.art}>
              <Image source={{ uri: tile.imageUrl }} style={styles.artImage} resizeMode="contain" />
            </View>
            <Text style={[styles.label, { color: selected ? ink : labelColor }, selected && { fontFamily: fonts.extrabold }]} numberOfLines={2}>
              {title}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: CHIP_GAP },
  chip: {
    width: CHIP_WIDTH, alignItems: "center", paddingTop: 8, paddingBottom: 8,
    borderRadius: 16, borderWidth: 1.5, borderColor: "transparent",
  },
  chipSelected: { backgroundColor: "rgba(255,255,255,0.9)" },
  art: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  artImage: { width: 50, height: 50 },
  label: {
    fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15,
    textAlign: "center", marginTop: 6, minHeight: 30, paddingHorizontal: 2,
  },
});
