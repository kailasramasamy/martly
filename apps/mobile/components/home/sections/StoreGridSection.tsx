import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { GridTile, TileGridSection } from "@martly/shared/types";
import { mix } from "../color-mix";
import { openCollection, useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { GAP, H_PADDING, TileArt, TileLabel, WIDTH, chunk, useTileLabel } from "./TileGridParts";

const BAND = "#eef4f3";
const WIDE_HEIGHT = 156;
const NORMAL_HEIGHT = 124;
const AWNING_HEIGHT = 14;
const STRIPE_TARGET = 18;
// Each store is painted its own deeper-but-soft colour; its awning stripes alternate that colour with a lighter one
const PAINTS = ["#bfe3d6", "#f6c6d2", "#ffd7a3", "#c6d8f5", "#e0cdf2"];

/** Wide stores pair up half a row each, the rest sit three to a row; a short last row stretches to fill it */
function packRows(tiles: GridTile[]) {
  return [...chunk(tiles.filter((t) => t.wide), 2), ...chunk(tiles.filter((t) => !t.wide), 3)];
}

/** A striped awning with a scalloped lower edge, drawn from Views so it scales to any tile width */
function Awning({ width, paint }: { width: number; paint: string }) {
  const count = Math.max(2, Math.round(width / STRIPE_TARGET));
  const stripe = width / count;
  const light = mix(paint, 255, 0.6);
  const deep = mix(paint, 0, 0.1);
  return (
    <View style={styles.awning} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => {
        const color = i % 2 === 0 ? deep : light;
        return (
          <View key={i} style={{ width: stripe }}>
            <View style={{ height: AWNING_HEIGHT, backgroundColor: color }} />
            <View style={{ height: stripe / 2, borderBottomLeftRadius: stripe / 2, borderBottomRightRadius: stripe / 2, backgroundColor: color }} />
          </View>
        );
      })}
    </View>
  );
}

interface TileProps {
  tile: GridTile;
  label: string;
  paint: string;
  width: number;
  height: number;
}

function StoreTile({ tile, label, paint, width, height }: TileProps) {
  return (
    <Pressable
      onPress={() => openCollection(tile.collectionId, tile.subcategoryIds)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { width, height, backgroundColor: paint }, pressed && styles.pressed]}
    >
      <Awning width={width} paint={paint} />
      <View style={styles.body}>
        <TileLabel text={label} width={tile.wide ? "62%" : "92%"} />
      </View>
      <TileArt tile={tile} size={tile.wide ? 112 : 78} />
    </Pressable>
  );
}

/** "Shop by store": mini storefronts, each with its own paint and a striped awning; wide ones in the first row */
export const StoreGridSection = memo(function StoreGridSection({ section }: { section: TileGridSection }) {
  const { title, subtitle } = useSectionText(section);
  const label = useTileLabel();
  let index = 0;
  return (
    <View style={styles.band}>
      <SectionHeader title={title} subtitle={subtitle} />
      <View style={styles.grid}>
        {packRows(section.tiles).map((row) => {
          const columns = row[0].wide ? 2 : 3;
          const width = row.length < columns ? (WIDTH - GAP * (row.length - 1)) / row.length : (WIDTH - GAP * (columns - 1)) / columns;
          return (
            <View key={row[0].id} style={styles.row}>
              {row.map((tile) => (
                <StoreTile key={tile.id} tile={tile} label={label(tile)} paint={PAINTS[index++ % PAINTS.length]} width={width} height={tile.wide ? WIDE_HEIGHT : NORMAL_HEIGHT} />
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
  tile: { borderRadius: 16, overflow: "hidden" },
  pressed: { opacity: 0.85 },
  awning: { flexDirection: "row" },
  body: { paddingHorizontal: 12, paddingTop: 6 },
});
