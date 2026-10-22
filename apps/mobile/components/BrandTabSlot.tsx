import { useEffect } from "react";
import { Text, Image, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import type { BrandSpotlight } from "@martly/shared/types";
import { useStrings } from "../lib/i18n/use-strings";
import { recordBannerTap, recordBannerView } from "../lib/banner-events";
import { TabIcon, TAB_INACTIVE, tabLabelStyle } from "./TabIcon";

/** The tab bar's last slot: the store's spotlight brand's logo (views and taps reported when the brand paid for it), or the brands directory */
export function BrandTabSlot({ brand, storeId }: { brand: BrandSpotlight | null; storeId: string | undefined }) {
  const t = useStrings("nav");
  const bannerId = brand?.sponsored?.bannerId;
  useEffect(() => {
    if (bannerId) recordBannerView(storeId, bannerId);
  }, [storeId, bannerId]);
  if (!brand) {
    return (
      <Pressable style={styles.plain} onPress={() => router.push("/brands")} accessibilityRole="button" accessibilityLabel={t.brands}>
        <TabIcon focused={false} icon="pricetags" />
        <Text style={[tabLabelStyle, { color: TAB_INACTIVE }]}>{t.brands}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      style={styles.tileSlot}
      onPress={() => {
        if (bannerId) recordBannerTap(storeId, bannerId);
        router.push(`/brand/${brand.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={t.shopBrand(brand.name)}
    >
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
