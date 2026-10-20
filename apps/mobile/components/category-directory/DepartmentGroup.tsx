import { Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDirectorySection } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { chunk } from "../home/sections/TileGridParts";

type Group = CategoryDirectorySection["groups"][number];
type Tile = Group["tiles"][number];

const H_PADDING = 16;
const GAP = 10;
const COLUMNS = 4;
const WIDTH = Dimensions.get("window").width - H_PADDING * 2;
const SQUARE_SIZE = Math.floor((WIDTH - GAP * (COLUMNS - 1)) / COLUMNS);
const WIDE_WIDTH = Math.floor((WIDTH - GAP) / 2);
const WIDE_HEIGHT = 96;
// Each department takes the next soft tint, so neighbouring groups read apart
export const DIRECTORY_TINTS = ["#fef3c7", "#e0f2fe", "#fce7f3", "#dcfce7", "#ede9fe", "#ffedd5"];

const openNode = (id: string) => router.push({ pathname: "/category/[id]", params: { id } });

// Uncapped, every tile shows. Capped, whole rows only, so no tile is left stranded on a short last row (a department
// with fewer than a row shows them all) and "See all" opens the rest
function squareRows(tiles: Tile[], maxRows?: number) {
  if (tiles.length === 0) return [];
  if (maxRows === undefined) return chunk(tiles, COLUMNS);
  const full = Math.min(Math.floor(tiles.length / COLUMNS), maxRows);
  return full === 0 ? [tiles] : chunk(tiles.slice(0, full * COLUMNS), COLUMNS);
}

function WideTile({ tile, label, tint }: { tile: Tile; label: string; tint: string }) {
  return (
    <Pressable
      onPress={() => openNode(tile.categoryId)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.wide, { backgroundColor: tint }, pressed && styles.pressed]}
    >
      <Text style={styles.wideLabel} numberOfLines={3}>{label}</Text>
      {tile.imageUrl ? <Image source={{ uri: tile.imageUrl }} style={styles.wideImage} resizeMode="contain" /> : null}
    </Pressable>
  );
}

function SquareTile({ tile, label, tint }: { tile: Tile; label: string; tint: string }) {
  return (
    <Pressable
      onPress={() => openNode(tile.categoryId)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.square, pressed && styles.pressed]}
    >
      <View style={[styles.squareArt, { backgroundColor: tint }]}>
        {tile.imageUrl
          ? <Image source={{ uri: tile.imageUrl }} style={styles.squareImage} resizeMode="contain" />
          : <Ionicons name={getCategoryIcon(tile.name)} size={28} color={colors.primary} />}
      </View>
      <Text style={styles.squareLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

interface GroupProps {
  group: Group;
  tint: string;
  /** Square rows shown past the wide tiles; unset shows every row */
  maxRows?: number;
}

/** A department heading with "See all", its wide tiles two to a row, then its other categories four to a row */
export function DepartmentGroup({ group, tint, maxRows }: GroupProps) {
  const c = useStrings("common");
  const t = useStrings("home");
  const { getLocalizedName } = useLanguage();
  const name = getLocalizedName(group);
  const wide = group.tiles.filter((t) => t.wide);
  const rows = squareRows(group.tiles.filter((t) => !t.wide), maxRows);
  return (
    <View style={styles.group}>
      <Pressable onPress={() => openNode(group.departmentId)} style={styles.head} accessibilityRole="link" accessibilityLabel={t.seeAllOf(name)}>
        <Text style={styles.department} numberOfLines={2}>{name}</Text>
        <Text style={styles.seeAll}>{c.seeAll}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
      {chunk(wide, 2).map((row) => (
        <View key={row[0].categoryId} style={styles.row}>
          {row.map((tile) => <WideTile key={tile.categoryId} tile={tile} label={getLocalizedName(tile)} tint={tint} />)}
        </View>
      ))}
      {rows.map((row) => (
        <View key={row[0].categoryId} style={styles.row}>
          {row.map((tile) => <SquareTile key={tile.categoryId} tile={tile} label={getLocalizedName(tile)} tint={tint} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: GAP },
  head: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 2 },
  department: { flex: 1, fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
  seeAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  row: { flexDirection: "row", gap: GAP },
  pressed: { opacity: 0.85 },
  wide: { width: WIDE_WIDTH, height: WIDE_HEIGHT, borderRadius: 16, overflow: "hidden", padding: 12 },
  wideLabel: { width: "62%", fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 18, color: colors.text },
  // Anchored to the corner and slightly oversized, so the pack sits into the tile rather than floating in it
  wideImage: { position: "absolute", right: -4, bottom: -6, width: WIDE_HEIGHT - 8, height: WIDE_HEIGHT - 8 },
  square: { width: SQUARE_SIZE, gap: 6 },
  squareArt: {
    width: SQUARE_SIZE, height: SQUARE_SIZE, borderRadius: 16, padding: 6, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  squareImage: { width: "100%", height: "100%" },
  // The label borrows half the gap on each side, so a long single word (common in Tamil) fits instead of splitting
  squareLabel: { marginHorizontal: -GAP / 2, fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 14, color: colors.text, textAlign: "center" },
});
