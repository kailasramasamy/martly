import { Text, Image, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import type { BrandSpotlight } from "@martly/shared/types";
import { useStrings } from "../lib/i18n/use-strings";
import { TabIcon, TAB_INACTIVE, tabLabelStyle } from "./TabIcon";

/** The tab bar's last slot: the store's spotlight brand's logo, or the brands directory when it has none */
export function BrandTabSlot({ brand }: { brand: BrandSpotlight | null }) {
  const t = useStrings("nav");
  if (!brand) {
    return (
      <Pressable style={styles.plain} onPress={() => router.push("/brands")} accessibilityRole="button" accessibilityLabel={t.brands}>
        <TabIcon focused={false} icon="pricetags" />
        <Text style={[tabLabelStyle, { color: TAB_INACTIVE }]}>{t.brands}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.tileSlot} onPress={() => router.push(`/brand/${brand.id}`)} accessibilityRole="button" accessibilityLabel={t.shopBrand(brand.name)}>
      <Image source={{ uri: brand.imageUrl }} style={styles.logo} resizeMode="contain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plain: { flex: 1, alignItems: "center", paddingTop: 5 },
  tileSlot: { flex: 1, paddingTop: 4, paddingHorizontal: 6 },
  // The logo alone fills the slot: wide logos use its width, square ones its height
  logo: { width: "100%", height: 48 },
});
