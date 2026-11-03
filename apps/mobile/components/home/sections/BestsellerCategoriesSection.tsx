import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { BestsellerCategoriesSection as BestsellerCategories } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";
import { useStrings } from "../../../lib/i18n/use-strings";
import { useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { chunk, H_PADDING, WIDTH } from "./TileGridParts";

type Category = BestsellerCategories["categories"][number];

const COLUMNS = 3;
const GAP = 10;
const CARD_PADDING = 4;
const CARD_WIDTH = Math.floor((WIDTH - GAP * (COLUMNS - 1)) / COLUMNS);
const TILE_SIZE = CARD_WIDTH - CARD_PADDING * 2;
// The lead pack sits low on the left; the other stands behind it on the right, tilted
const BACK_PACK = { width: Math.round(TILE_SIZE * 0.62), height: Math.round(TILE_SIZE * 0.8) };
const FRONT_PACK = { width: Math.round(TILE_SIZE * 0.66), height: Math.round(TILE_SIZE * 0.66) };
const FRONT_FLOOR = 10;

/** A category pictured by its two best sellers on one tile, with how many more it stocks and its name */
function CategoryCard({ category }: { category: Category }) {
  const t = useStrings("home");
  const { getLocalizedName } = useLanguage();
  const name = getLocalizedName(category);
  const [front, back] = category.images;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/category/[id]", params: { id: category.id } })}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.tile}>
        <Image source={{ uri: back }} style={styles.backPack} resizeMode="contain" />
        <Image source={{ uri: front }} style={styles.frontPack} resizeMode="contain" />
        {category.more > 0 && (
          <View style={styles.moreRow}>
            <View style={styles.morePill}>
              <Text style={styles.moreText}>{t.moreProducts(category.more)}</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
    </Pressable>
  );
}

/** The store's best-selling categories, three to a row, right under the festive top */
export const BestsellerCategoriesSection = memo(function BestsellerCategoriesSection({ section }: { section: BestsellerCategories }) {
  const t = useStrings("home");
  const { title, subtitle } = useSectionText(section);
  return (
    <View style={styles.section}>
      <SectionHeader title={title ?? t.bestsellers} subtitle={subtitle} />
      <View style={styles.grid}>
        {chunk(section.categories, COLUMNS).map((row) => (
          <View key={row[0].id} style={styles.row}>
            {row.map((category) => <CategoryCard key={category.id} category={category} />)}
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  grid: { paddingHorizontal: H_PADDING, gap: GAP },
  row: { flexDirection: "row", gap: GAP },
  card: { width: CARD_WIDTH, borderRadius: 16, backgroundColor: "#e8f1f1", padding: CARD_PADDING, paddingBottom: 10 },
  pressed: { opacity: 0.85 },
  tile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 12, backgroundColor: colors.background, marginBottom: 14 },
  backPack: { position: "absolute", top: 4, right: 7, transform: [{ rotate: "10deg" }], ...BACK_PACK },
  frontPack: { position: "absolute", left: 3, bottom: FRONT_FLOOR, ...FRONT_PACK },
  // Sits across the bottom edge of the tile, the way a count badge tucks under a stack
  moreRow: { position: "absolute", bottom: -10, left: 0, right: 0, alignItems: "center" },
  morePill: {
    paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  moreText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  name: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: colors.text, textAlign: "center", minHeight: 34 },
});
