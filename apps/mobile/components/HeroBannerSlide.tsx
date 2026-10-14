import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { colors, fonts } from "../constants/theme";
import { useLanguage } from "../lib/language-context";
import type { Banner } from "../lib/types";

interface Props {
  banner: Banner;
  width: number;
  height?: number;
  onPress: (banner: Banner) => void;
}

/** Banners are 3:2 artwork, shown untouched; text-free art gets its title below the image, never on it. */
export const BANNER_ASPECT = 3 / 2;

export function HeroBannerSlide({ banner, width, height = width / BANNER_ASPECT, onPress }: Props) {
  const { language } = useLanguage();
  const imageUrl = (language && banner.imageUrls?.[language]) || banner.imageUrl;
  const tappable = banner.actionType !== "NONE";
  return (
    <Pressable
      style={({ pressed }) => [{ width }, pressed && tappable && styles.pressed]}
      onPress={() => onPress(banner)}
      disabled={!tappable}
      accessibilityRole={tappable ? "button" : "image"}
      accessibilityLabel={[banner.title, banner.subtitle].filter(Boolean).join(". ")}
    >
      <Image source={{ uri: imageUrl }} style={[styles.image, { height }]} resizeMode="cover" />
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
  caption: { paddingHorizontal: 4, paddingTop: 8 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
