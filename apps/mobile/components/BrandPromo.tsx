import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { brandDisplayName, brandTheme } from "../lib/brand-strip";
import { useStrings } from "../lib/i18n/use-strings";

interface Brand { id: string; name: string; imageUrl?: string | null; themeColor?: string | null; themeColorSecondary?: string | null }

const openStore = (brand: Brand) => router.push(`/brand/${brand.id}`);

// Logo + name in the brand's colour, above the product name: recognisable at a glance, taps through to its store
export function BrandChip({ brand }: { brand: Brand }) {
  const t = useStrings("home");
  const { base } = brandTheme(brand);
  const name = brandDisplayName(brand.name);
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, { borderColor: `${base}55`, backgroundColor: `${base}0F` }, pressed && styles.pressed]}
      onPress={() => openStore(brand)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t.visitBrandStore(name)}
    >
      {brand.imageUrl && (
        <View style={styles.chipLogo}>
          <Image source={{ uri: brand.imageUrl }} style={styles.logoImg} resizeMode="contain" />
        </View>
      )}
      <Text style={[styles.chipName, { color: base }]} numberOfLines={1}>{name}</Text>
      <Ionicons name="chevron-forward" size={14} color={base} />
    </Pressable>
  );
}

// Brand-store call to action in the brand's own gradient, after the product details
export function BrandStoreBanner({ brand }: { brand: Brand }) {
  const t = useStrings("home");
  const { base, dark, accent } = brandTheme(brand);
  const name = brandDisplayName(brand.name);
  return (
    <Pressable onPress={() => openStore(brand)} accessibilityRole="button" accessibilityLabel={t.visitBrandStore(name)}>
      {({ pressed }) => (
        <LinearGradient
          colors={[base, dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.banner, brand.themeColorSecondary && { borderBottomWidth: 4, borderBottomColor: accent }, pressed && styles.pressed]}
        >
          <View style={styles.orb} />
          <Text style={styles.watermark} numberOfLines={1}>{name}</Text>
          <View style={styles.bannerLogo}>
            {brand.imageUrl
              ? <Image source={{ uri: brand.imageUrl }} style={styles.logoImg} resizeMode="contain" />
              : <Text style={[styles.bannerWordmark, { color: base }]} numberOfLines={2}>{name}</Text>}
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.eyebrow}>{t.brandStore}</Text>
            <Text style={styles.bannerTitle} numberOfLines={1}>{t.shopAllBrand(name)}</Text>
            <Text style={styles.bannerSub}>{t.brandBannerSub}</Text>
          </View>
          <View style={styles.go}>
            <Ionicons name="arrow-forward" size={18} color={base} />
          </View>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", maxWidth: "100%",
    minHeight: 34, paddingLeft: 4, paddingRight: 10, borderRadius: 17, borderWidth: 1,
  },
  chipLogo: { width: 44, height: 26, borderRadius: 13, backgroundColor: "#fff", padding: 3, alignItems: "center", justifyContent: "center" },
  logoImg: { width: "100%", height: "100%" },
  chipName: { fontFamily: fonts.extrabold, fontSize: 13.5, letterSpacing: -0.1, flexShrink: 1, marginLeft: 2 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, padding: 14, borderRadius: 18, overflow: "hidden",
  },
  orb: { position: "absolute", width: 150, height: 150, borderRadius: 75, top: -60, right: -40, backgroundColor: "rgba(255,255,255,0.12)" },
  watermark: {
    position: "absolute", right: -6, bottom: -14, fontFamily: fonts.extrabold, fontSize: 54, letterSpacing: -3,
    color: "rgba(255,255,255,0.08)",
  },
  bannerLogo: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: "#fff", padding: 6, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  bannerWordmark: { fontFamily: fonts.extrabold, fontSize: 12, textAlign: "center" },
  bannerText: { flex: 1 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 1.6, color: "rgba(255,255,255,0.78)" },
  bannerTitle: { fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.4, color: "#fff", marginTop: 1 },
  bannerSub: { fontFamily: fonts.semibold, fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  go: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});
