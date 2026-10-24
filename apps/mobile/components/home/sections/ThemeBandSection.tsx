import { memo, useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { ThemeBandSection as ThemeBand } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";
import { mix } from "../color-mix";
import { useSectionText } from "./context";
import { H_PADDING, WIDTH } from "./TileGridParts";

type Tile = ThemeBand["tiles"][number];

const COLUMNS = 4;
const GAP = 10;
const TILE_SIZE = Math.floor((WIDTH - GAP * (COLUMNS - 1)) / COLUMNS);
const TILE_HEIGHT = Math.round(TILE_SIZE * 1.1);
const ART_SIZE = 96;
// Tiles sit a shade deeper than the band, so they read as cards without a border
const TILE_DEEPEN = 0.06;

function BandTile({ tile, background }: { tile: Tile; background: string }) {
  const { getLocalizedName } = useLanguage();
  const label = getLocalizedName({ name: tile.label, translations: tile.translations });
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/category/[id]", params: { id: tile.subcategoryId } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.tileArt, { backgroundColor: background }]}>
        {tile.imageUrl ? <Image source={{ uri: tile.imageUrl }} style={styles.tileImage} resizeMode="contain" /> : null}
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

/** A full-width pastel band between shelves: a themed title, subtitle and art, over a row of aisle tiles */
export const ThemeBandSection = memo(function ThemeBandSection({ section }: { section: ThemeBand }) {
  const { title, subtitle } = useSectionText(section);
  const tileBackground = useMemo(() => mix(section.tint, 0, TILE_DEEPEN), [section.tint]);
  return (
    <View style={[styles.band, { backgroundColor: section.tint }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          {title ? <Text style={styles.title} numberOfLines={2}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {section.imageUrl ? <Image source={{ uri: section.imageUrl }} style={styles.art} resizeMode="contain" /> : null}
      </View>
      <View style={styles.row}>
        {section.tiles.map((tile) => <BandTile key={tile.id} tile={tile} background={tileBackground} />)}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  band: { marginTop: 24, paddingHorizontal: H_PADDING, paddingTop: 18, paddingBottom: 20, gap: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: ART_SIZE * 0.7 },
  headText: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, lineHeight: 24, color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  art: { width: ART_SIZE, height: ART_SIZE * 0.8, marginVertical: -8 },
  row: { flexDirection: "row", gap: GAP },
  tile: { width: TILE_SIZE, gap: 6 },
  pressed: { opacity: 0.85 },
  tileArt: { width: TILE_SIZE, height: TILE_HEIGHT, borderRadius: 16, padding: 4, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  tileImage: { width: "100%", height: "100%" },
  tileLabel: { marginHorizontal: -GAP / 2, minHeight: 34, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.text, textAlign: "center" },
});
