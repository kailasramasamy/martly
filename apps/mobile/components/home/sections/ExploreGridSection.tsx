import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { GridTile, TileGridSection } from "@martly/shared/types";
import { openCollection, useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { GAP, H_PADDING, TileArt, TileLabel, WIDTH, useTileLabel } from "./TileGridParts";

const COLUMNS = 3;
const TILE_HEIGHT = 112;
const COLUMN_WIDTH = Math.floor((WIDTH - GAP * (COLUMNS - 1)) / COLUMNS);
const WIDE_WIDTH = COLUMN_WIDTH * 2 + GAP;
const BAND = "#faf6ee";
// Each tile takes the next pastel, so neighbours (across and down) never share one
const TINTS = ["#ffe4d6", "#dff3e4", "#e3ebff", "#fde7f1", "#fff1bf", "#e0f2f1", "#efe5fb", "#ffe9cf"];

const span = (tile: GridTile) => (tile.wide ? 2 : 1);

/** Whole rows of three columns, a wide tile taking two; a tile that wouldn't fit starts the next row */
function packRows(tiles: GridTile[]) {
  const rows: GridTile[][] = [];
  let used = 0;
  tiles.forEach((tile) => {
    if (!rows.length || used + span(tile) > COLUMNS) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(tile);
    used += span(tile);
  });
  return rows;
}

interface TileProps {
  tile: GridTile;
  label: string;
  tint: string;
  /** In a short last row the tiles stretch to fill it, sized by their columns */
  stretch: boolean;
}

function ExploreTile({ tile, label, tint, stretch }: TileProps) {
  const sizing = stretch ? { flex: span(tile) } : { width: tile.wide ? WIDE_WIDTH : COLUMN_WIDTH };
  return (
    <Pressable
      onPress={() => openCollection(tile.collectionId, tile.subcategoryIds)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, sizing, { backgroundColor: tint }, pressed && styles.pressed]}
    >
      <TileLabel text={label} width={tile.wide ? "58%" : "92%"} />
      <TileArt tile={tile} size={tile.wide ? 104 : 84} />
    </Pressable>
  );
}

/** "Explore by mood": soft pastel tiles with their art tucked into the corner, laid out in whole rows on one band */
export const ExploreGridSection = memo(function ExploreGridSection({ section }: { section: TileGridSection }) {
  const { title, subtitle } = useSectionText(section);
  const label = useTileLabel();
  let index = 0;
  return (
    <View style={styles.band}>
      <SectionHeader title={title} subtitle={subtitle} />
      <View style={styles.grid}>
        {packRows(section.tiles).map((row) => {
          const stretch = row.reduce((sum, t) => sum + span(t), 0) < COLUMNS;
          return (
            <View key={row[0].id} style={styles.row}>
              {row.map((tile) => (
                <ExploreTile key={tile.id} tile={tile} label={label(tile)} tint={TINTS[index++ % TINTS.length]} stretch={stretch} />
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  band: { marginTop: 24, paddingVertical: 18, backgroundColor: BAND },
  grid: { paddingHorizontal: H_PADDING, gap: GAP },
  row: { flexDirection: "row", gap: GAP },
  tile: { height: TILE_HEIGHT, borderRadius: 16, overflow: "hidden", padding: 12 },
  pressed: { opacity: 0.85 },
});
