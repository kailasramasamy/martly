import { memo } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import type { GridTile } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";
import { PackCluster } from "./PackCluster";

export const H_PADDING = 16;
export const GAP = 10;
export const WIDTH = Dimensions.get("window").width - H_PADDING * 2;

/** A tile's label in the shopper's language: grid tiles and campaign aisle tiles share this shape */
export function useTileLabel() {
  const { language } = useLanguage();
  return (tile: Pick<GridTile, "label"> & { translations?: Record<string, { label?: string }> | null }) =>
    (language && tile.translations?.[language]?.label) || tile.label;
}

export function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

interface ArtProps {
  tile: GridTile;
  size: number;
}

/** The tile's cut-out art tucked into its bottom-right corner and a little oversized, else a cluster of the
 *  collection's packs; a tile with neither shows only its label */
export const TileArt = memo(function TileArt({ tile, size }: ArtProps) {
  const style = { width: size, height: size, right: -size * 0.06, bottom: -size * 0.08 };
  if (tile.imageUrl) {
    return <Image source={{ uri: tile.imageUrl }} style={[styles.art, style]} resizeMode="contain" />;
  }
  if (!tile.packImages.length) return null;
  return (
    <View style={[styles.art, style]} pointerEvents="none">
      <PackCluster images={tile.packImages} size={size} />
    </View>
  );
});

export const TileLabel = memo(function TileLabel({ text, width }: { text: string; width: `${number}%` }) {
  return <Text style={[styles.label, { width }]} numberOfLines={2}>{text}</Text>;
});

const styles = StyleSheet.create({
  art: { position: "absolute" },
  label: { fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 18, letterSpacing: -0.2, color: colors.text },
});
