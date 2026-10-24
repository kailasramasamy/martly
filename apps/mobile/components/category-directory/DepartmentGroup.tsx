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
// A touch taller than wide, so the category art stands up in it
const TILE_HEIGHT = Math.round(SQUARE_SIZE * 1.1);
// Breathing room around the art, so it fills most of the tile without crowding its edges
const ART_INSET = 4;
// Rows sit further apart than tiles side by side, so each label reads with the picture above it
const ROW_GAP = 16;
// One quiet tile colour for every department, so the category art does the talking
const TILE_BACKGROUND = "#e8f1f1";

const openNode = (id: string) => router.push({ pathname: "/category/[id]", params: { id } });

// Uncapped, every tile shows. Capped, whole rows only, so no tile is left stranded on a short last row (a department
// with fewer than a row shows them all) and "See all" opens the rest
function squareRows(tiles: Tile[], maxRows?: number) {
  if (tiles.length === 0) return [];
  if (maxRows === undefined) return chunk(tiles, COLUMNS);
  const full = Math.min(Math.floor(tiles.length / COLUMNS), maxRows);
  return full === 0 ? [tiles] : chunk(tiles.slice(0, full * COLUMNS), COLUMNS);
}

function SquareTile({ tile, label }: { tile: Tile; label: string }) {
  return (
    <Pressable
      onPress={() => openNode(tile.categoryId)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.square, pressed && styles.pressed]}
    >
      <View style={styles.squareArt}>
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
  /** Rows shown; unset shows every row */
  maxRows?: number;
}

/** A department heading with "See all", then its categories four to a row */
export function DepartmentGroup({ group, maxRows }: GroupProps) {
  const c = useStrings("common");
  const t = useStrings("home");
  const { getLocalizedName } = useLanguage();
  const name = getLocalizedName(group);
  const rows = squareRows(group.tiles, maxRows);
  return (
    <View style={styles.group}>
      <Pressable onPress={() => openNode(group.departmentId)} style={styles.head} accessibilityRole="link" accessibilityLabel={t.seeAllOf(name)}>
        <Text style={styles.department} numberOfLines={2}>{name}</Text>
        <Text style={styles.seeAll}>{c.seeAll}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
      {rows.map((row) => (
        <View key={row[0].categoryId} style={styles.row}>
          {row.map((tile) => <SquareTile key={tile.categoryId} tile={tile} label={getLocalizedName(tile)} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: ROW_GAP },
  head: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 2 },
  department: { flex: 1, fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
  seeAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  row: { flexDirection: "row", gap: GAP },
  pressed: { opacity: 0.85 },
  square: { width: SQUARE_SIZE, gap: 6 },
  squareArt: {
    width: SQUARE_SIZE, height: TILE_HEIGHT, borderRadius: 16, padding: ART_INSET, overflow: "hidden", backgroundColor: TILE_BACKGROUND,
    alignItems: "center", justifyContent: "center",
  },
  squareImage: { width: "100%", height: "100%" },
  // The label borrows half the gap on each side, so a long single word (common in Tamil) fits instead of splitting
  // Two lines are always reserved, so a row's labels line up whether they wrap or not
  squareLabel: {
    marginHorizontal: -GAP / 2, minHeight: 34, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.text, textAlign: "center",
  },
});
