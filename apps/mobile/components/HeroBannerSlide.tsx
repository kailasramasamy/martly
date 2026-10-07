import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import type { Banner } from "../lib/types";

interface Props {
  banner: Banner;
  width: number;
  height?: number;
  onPress: (banner: Banner) => void;
}

const CTA_LABEL: Partial<Record<Banner["actionType"], string>> = {
  CATEGORY: "Shop now",
  COLLECTION: "Shop now",
  SEARCH: "Shop now",
  PRODUCT: "View product",
  URL: "Learn more",
};

export function HeroBannerSlide({ banner, width, height = 176, onPress }: Props) {
  const cta = CTA_LABEL[banner.actionType];
  return (
    <Pressable
      style={({ pressed }) => [styles.slide, { width, height }, pressed && cta && styles.pressed]}
      onPress={() => onPress(banner)}
      disabled={!cta}
      accessibilityRole={cta ? "button" : "image"}
      accessibilityLabel={[banner.title, banner.subtitle].filter(Boolean).join(". ")}
    >
      <Image source={{ uri: banner.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(15,23,42,0.82)", "rgba(15,23,42,0.5)", "rgba(15,23,42,0)"]}
        locations={[0, 0.45, 0.85]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{banner.title}</Text>
        {banner.subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{banner.subtitle}</Text> : null}
        {cta && (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.text} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slide: { borderRadius: 18, overflow: "hidden", backgroundColor: "#e2e8f0" },
  pressed: { opacity: 0.94 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 20, maxWidth: "64%" },
  title: {
    fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 27, color: "#fff", letterSpacing: -0.4,
    textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 6,
  },
  subtitle: {
    fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.88)", marginTop: 6,
  },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, height: 34, marginTop: 14,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
});
