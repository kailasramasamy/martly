import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CampaignTile } from "@martly/shared/types";
import { colors, fonts } from "../../../../constants/theme";
import { useStrings } from "../../../../lib/i18n/use-strings";
import { PackCluster } from "../PackCluster";
import { useTileLabel } from "../TileGridParts";

const CLUSTER = 48;
// Every chip is the same size, so the row reads as a set whatever the aisle names
const CHIP_WIDTH = 156;
const CHIP_HEIGHT = 62;

interface Props {
  tiles: CampaignTile[];
  /** Chip edge: a deeper tone of the campaign colour */
  rim: string;
  onTile: (tile: CampaignTile) => void;
}

/** The campaign's aisles as chips along the bottom of the card, packs on the left and the name and count on the right;
 *  each opens the campaign narrowed to that aisle */
export const AisleShelf = memo(function AisleShelf({ tiles, rim, onTile }: Props) {
  const c = useStrings("common");
  const labelOf = useTileLabel();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tiles.map((tile) => (
        <Pressable
          key={tile.id}
          onPress={() => onTile(tile)}
          accessibilityRole="button"
          accessibilityLabel={`${labelOf(tile)}, ${c.items(tile.productCount)}`}
          style={({ pressed }) => [styles.chip, { borderColor: rim }, pressed && styles.pressed]}
        >
          <View style={styles.art}><PackCluster images={tile.images} size={CLUSTER} /></View>
          <View style={styles.text}>
            <Text style={styles.label} numberOfLines={2}>{labelOf(tile)}</Text>
            <Text style={styles.count}>{c.items(tile.productCount)}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, gap: 8 },
  chip: {
    width: CHIP_WIDTH, height: CHIP_HEIGHT, flexDirection: "row", alignItems: "center", gap: 6,
    paddingLeft: 4, paddingRight: 10, borderRadius: 16, borderWidth: 1, backgroundColor: "#ffffff",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  art: { width: CLUSTER + 6, height: CLUSTER + 6, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  label: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 15, color: colors.text },
  count: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
});
