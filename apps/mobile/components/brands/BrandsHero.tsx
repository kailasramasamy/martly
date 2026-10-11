import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { DirectoryBrand } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { brandDisplayName, brandTheme } from "../../lib/brand-strip";

interface HeroProps {
  storeName?: string;
  brandCount: number;
  categoryCount: number;
  query: string;
  onQuery: (q: string) => void;
}

export const HERO_TOP = "#0f766e";

// Teal masthead with an amber accent rule, a giant "BRANDS" watermark and the search field.
// It starts below the status bar; the screen fills the status bar with HERO_TOP so the two read as one
export function BrandsHero({ storeName, brandCount, categoryCount, query, onQuery }: HeroProps) {
  return (
    <LinearGradient colors={[HERO_TOP, "#134e4a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={[styles.orb, styles.orbLarge]} />
      <View style={[styles.orb, styles.orbAmber]} />
      <Text style={styles.watermark} numberOfLines={1}>BRANDS</Text>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>
      <Text style={styles.eyebrow}>{storeName ? `AT ${storeName.toUpperCase()}` : "ALL BRANDS"}</Text>
      <Text style={styles.title}>Shop by brand</Text>
      <View style={styles.rule} />
      <Text style={styles.meta}>{brandCount} brands across {categoryCount} categories</Text>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search a brand"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => onQuery("")} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

function FeaturedCard({ brand }: { brand: DirectoryBrand }) {
  const { base, dark, accent } = brandTheme(brand);
  const name = brandDisplayName(brand.name);
  return (
    <Pressable onPress={() => router.push(`/brand/${brand.id}`)} accessibilityRole="button" accessibilityLabel={`Visit ${name} store`}>
      {({ pressed }) => (
        <LinearGradient colors={[base, dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, brand.themeColorSecondary && { borderBottomWidth: 4, borderBottomColor: accent }, pressed && styles.pressed]}>
          <View style={[styles.orb, styles.cardOrb]} />
          <Text style={styles.cardWatermark} numberOfLines={1}>{name}</Text>
          <View style={styles.cardLogo}>
            {brand.imageUrl && <Image source={{ uri: brand.imageUrl }} style={styles.cardLogoImg} resizeMode="contain" />}
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.cardText}>
              <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
              <Text style={styles.cardMeta}>{brand.productCount} products</Text>
            </View>
            <View style={styles.visit}>
              <Text style={[styles.visitText, { color: base }]}>Visit</Text>
              <Ionicons name="arrow-forward" size={13} color={base} />
            </View>
          </View>
        </LinearGradient>
      )}
    </Pressable>
  );
}

// "Brand stores" carousel: brands with their own store get a full-colour card
export function FeaturedBrands({ brands }: { brands: DirectoryBrand[] }) {
  if (brands.length === 0) return null;
  return (
    <View style={styles.featured}>
      <View style={styles.featuredHead}>
        <Text style={styles.featuredTitle}>Brand stores</Text>
        <Text style={styles.featuredSub}>Their full range, in one place</Text>
      </View>
      <FlatList
        horizontal
        data={brands}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <FeaturedCard brand={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuredList}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
      />
    </View>
  );
}

const CARD_WIDTH = 232;

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18, overflow: "hidden" },
  orb: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  orbLarge: { width: 280, height: 280, top: -110, right: -90 },
  orbAmber: { width: 140, height: 140, bottom: -70, left: -40, backgroundColor: "rgba(251,191,36,0.16)" },
  watermark: {
    position: "absolute", right: -18, top: 62, fontFamily: fonts.extrabold, fontSize: 92,
    letterSpacing: -5, color: "rgba(255,255,255,0.07)",
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: 1.8, color: "rgba(255,255,255,0.75)", marginTop: 14 },
  title: { fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -0.9, color: "#fff", marginTop: 2 },
  rule: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginTop: 8 },
  meta: { fontFamily: fonts.semibold, fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 8 },
  search: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, height: 46, borderRadius: 14,
    paddingHorizontal: 14, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, paddingVertical: 0 },
  featured: { paddingTop: 18, paddingBottom: 6, backgroundColor: "#fdf8ee" },
  featuredHead: { paddingHorizontal: 16, marginBottom: 12 },
  featuredTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.3 },
  featuredSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  featuredList: { paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  card: { width: CARD_WIDTH, height: 148, borderRadius: 20, padding: 14, overflow: "hidden", justifyContent: "space-between" },
  pressed: { transform: [{ scale: 0.97 }] },
  cardOrb: { width: 170, height: 170, top: -70, right: -50, backgroundColor: "rgba(255,255,255,0.12)" },
  cardWatermark: {
    position: "absolute", left: 10, bottom: 34, fontFamily: fonts.extrabold, fontSize: 58,
    letterSpacing: -3, color: "rgba(255,255,255,0.09)",
  },
  cardLogo: {
    width: 92, height: 52, borderRadius: 12, backgroundColor: "#fff", padding: 6,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  cardLogoImg: { width: "100%", height: "100%" },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  cardText: { flex: 1 },
  cardName: { fontFamily: fonts.extrabold, fontSize: 19, color: "#fff", letterSpacing: -0.4 },
  cardMeta: { fontFamily: fonts.semibold, fontSize: 12, color: "rgba(255,255,255,0.85)" },
  visit: { flexDirection: "row", alignItems: "center", gap: 3, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#fff" },
  visitText: { fontFamily: fonts.extrabold, fontSize: 12.5 },
});
