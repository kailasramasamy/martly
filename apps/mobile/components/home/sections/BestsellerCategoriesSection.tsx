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
const CARD_PADDING = 6;
const IMAGE_GAP = 4;
const CARD_WIDTH = Math.floor((WIDTH - GAP * (COLUMNS - 1)) / COLUMNS);
const IMAGE_SIZE = Math.floor((CARD_WIDTH - CARD_PADDING * 2 - IMAGE_GAP) / 2);

/** A category pictured by its four best sellers in a 2×2 grid, with how many more it stocks and its name */
function CategoryCard({ category }: { category: Category }) {
  const t = useStrings("home");
  const { getLocalizedName } = useLanguage();
  const name = getLocalizedName(category);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/category/[id]", params: { id: category.id } })}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.images}>
        {category.images.map((uri) => (
          <View key={uri} style={styles.imageBox}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          </View>
        ))}
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
  images: { flexDirection: "row", flexWrap: "wrap", gap: IMAGE_GAP, marginBottom: 14 },
  imageBox: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 10, backgroundColor: colors.background, padding: 4 },
  image: { width: "100%", height: "100%" },
  // Sits across the bottom edge of the image grid, the way a count badge tucks under a stack
  moreRow: { position: "absolute", bottom: -10, left: 0, right: 0, alignItems: "center" },
  morePill: {
    paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  moreText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  name: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: colors.text, textAlign: "center", minHeight: 34 },
});
