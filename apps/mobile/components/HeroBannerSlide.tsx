import { useEffect } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { colors, fonts } from "../constants/theme";
import { useLanguage } from "../lib/language-context";
import { useStore } from "../lib/store-context";
import { useStrings } from "../lib/i18n/use-strings";
import { recordBannerTap, recordBannerView } from "../lib/banner-events";
import type { Banner } from "../lib/types";

interface Props {
  banner: Banner;
  width: number;
  height?: number;
  onPress: (banner: Banner) => void;
  /** False while the slide is off-screen in a carousel, so only what the customer sees counts as a view */
  visible?: boolean;
}

/** Banners are 3:2 artwork, shown untouched; text-free art gets its title below the image, never on it. */
export const BANNER_ASPECT = 3 / 2;

export function HeroBannerSlide({ banner, width, height = width / BANNER_ASPECT, onPress, visible = true }: Props) {
  const { language } = useLanguage();
  const t = useStrings("home");
  const storeId = useStore().selectedStore?.id;
  useEffect(() => {
    if (visible) recordBannerView(storeId, banner.id);
  }, [visible, storeId, banner.id]);
  const imageUrl = (language && banner.imageUrls?.[language]) || banner.imageUrl;
  const tappable = banner.actionType !== "NONE";
  return (
    <Pressable
      style={({ pressed }) => [{ width }, pressed && tappable && styles.pressed]}
      onPress={() => {
        recordBannerTap(storeId, banner.id);
        onPress(banner);
      }}
      disabled={!tappable}
      accessibilityRole={tappable ? "button" : "image"}
      accessibilityLabel={[banner.title, banner.subtitle].filter(Boolean).join(". ")}
    >
      <Image source={{ uri: imageUrl }} style={[styles.image, { height }]} resizeMode="cover" />
      {banner.sponsorType === "BRAND" && <Text style={styles.sponsored}>{t.sponsored}</Text>}
      {!banner.textInImage && (
        <View style={styles.caption}>
          <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
          {banner.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{banner.subtitle}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.94 },
  image: { width: "100%", borderRadius: 20, backgroundColor: colors.border },
  sponsored: {
    position: "absolute", top: 8, left: 8, fontFamily: fonts.semibold, fontSize: 11, color: "#fff",
    backgroundColor: "rgba(15,23,42,0.55)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden",
  },
  caption: { paddingHorizontal: 4, paddingTop: 8 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
