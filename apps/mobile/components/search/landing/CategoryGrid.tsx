import { Dimensions, View, StyleSheet } from "react-native";
import { spacing } from "../../../constants/theme";
import { CategoryTile } from "../../CategoryTile";
import { useLanguage } from "../../../lib/language-context";
import type { SearchLanding } from "../../../lib/types";

const COLUMNS = 4;
const GAP = 10;
const TILE_SIZE = Math.floor((Dimensions.get("window").width - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

export function CategoryGrid({ categories, onPress }: { categories: SearchLanding["categories"]; onPress: (id: string) => void }) {
  const { getLocalizedName } = useLanguage();
  return (
    <View style={styles.grid}>
      {categories.map((c) => (
        <CategoryTile
          key={c.id}
          title={getLocalizedName(c)}
          imageUrl={c.imageUrl}
          fallbackIcon="basket-outline"
          size={TILE_SIZE}
          onPress={() => onPress(c.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: GAP, rowGap: spacing.md, paddingHorizontal: spacing.md },
});
