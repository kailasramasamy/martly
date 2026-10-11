import type { RefObject } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { brandDisplayName, brandTheme } from "../lib/brand-strip";
import { useLanguage } from "../lib/language-context";
import type { BrandCategory } from "../lib/brand-store";

export interface BrandInfo { name: string; imageUrl: string | null; themeColor: string | null }

interface HeroProps {
  brand: BrandInfo;
  productCount: number;
  categoryCount: number;
  query: string;
  onQuery: (q: string) => void;
  inputRef?: RefObject<TextInput | null>;
}

// Full-bleed brand hero: runs under the status bar, carries the back button, brand block and in-store search
export function BrandHero({ brand, productCount, categoryCount, query, onQuery, inputRef }: HeroProps) {
  const insets = useSafeAreaInsets();
  const { base, dark } = brandTheme(brand);
  const name = brandDisplayName(brand.name);
  return (
    <LinearGradient colors={[base, dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 6 }]}>
      <View style={[styles.orb, styles.orbLarge]} />
      <View style={[styles.orb, styles.orbSmall]} />
      <Text style={styles.watermark} numberOfLines={1}>{name}</Text>

      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>

      <View style={styles.brandRow}>
        <View style={styles.logoTile}>
          {brand.imageUrl
            ? <Image source={{ uri: brand.imageUrl }} style={styles.logo} resizeMode="contain" />
            : <Text style={[styles.logoWordmark, { color: base }]} numberOfLines={2}>{name}</Text>}
        </View>
        <View style={styles.brandText}>
          <Text style={styles.eyebrow}>BRAND STORE</Text>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.meta}>
            {productCount} products · {categoryCount} {categoryCount === 1 ? "category" : "categories"}
          </Text>
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onQuery}
          placeholder={`Search in ${name}`}
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

function Tile({ label, imageUrl, active, color, onPress, zoom = true }: {
  label: string; imageUrl?: string | null; active: boolean; color: string; onPress: () => void; zoom?: boolean;
}) {
  return (
    <Pressable style={styles.tile} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <View style={[styles.tileRing, active && { borderColor: color }]}>
        <View style={[styles.tileImage, active && styles.tileImageActive]}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={[styles.tileImg, zoom && styles.tileZoom]} resizeMode="contain" /> : <Ionicons name="grid-outline" size={22} color={color} />}
        </View>
      </View>
      <Text style={[styles.tileLabel, active && { color, fontFamily: fonts.extrabold }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

// Category picker as image tiles; "All" carries the brand logo
export function BrandCategoryTiles({ brand, categories, activeId, onSelect }: {
  brand: BrandInfo; categories: BrandCategory[]; activeId: string | null; onSelect: (id: string | null) => void;
}) {
  const { getLocalizedName } = useLanguage();
  const { base } = brandTheme(brand);
  if (categories.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiles} contentContainerStyle={styles.tilesContent}>
      <Tile label="All" imageUrl={brand.imageUrl} active={activeId === null} color={base} onPress={() => onSelect(null)} zoom={false} />
      {categories.map((c) => (
        <Tile key={c.id} label={getLocalizedName(c)} imageUrl={c.imageUrl} active={activeId === c.id} color={base} onPress={() => onSelect(c.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 16, overflow: "hidden" },
  orb: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.09)" },
  orbLarge: { width: 260, height: 260, top: -90, right: -70 },
  orbSmall: { width: 120, height: 120, bottom: -40, left: -30 },
  watermark: {
    position: "absolute", right: -10, top: 56, fontFamily: fonts.extrabold, fontSize: 96,
    letterSpacing: -4, color: "rgba(255,255,255,0.08)",
  },
  back: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 },
  logoTile: {
    width: 78, height: 78, borderRadius: 20, backgroundColor: "#fff", padding: 8,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  logo: { width: "100%", height: "100%" },
  logoWordmark: { fontFamily: fonts.extrabold, fontSize: 15, textAlign: "center", letterSpacing: -0.3 },
  brandText: { flex: 1 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: 1.8, color: "rgba(255,255,255,0.78)" },
  name: { fontFamily: fonts.extrabold, fontSize: 26, color: "#fff", letterSpacing: -0.6, marginTop: 1 },
  meta: { fontFamily: fonts.semibold, fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  search: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, height: 46, borderRadius: 14,
    paddingHorizontal: 14, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, paddingVertical: 0 },
  tiles: { flexGrow: 0, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  tilesContent: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8, gap: 2 },
  tile: { width: 88, alignItems: "center" },
  // Offset selection ring: always reserves its space (no layout shift) and never touches the image
  tileRing: { padding: 2, borderRadius: 25, borderWidth: 2, borderColor: "transparent" },
  tileImage: {
    width: 76, height: 76, borderRadius: 20, backgroundColor: "#fff", padding: 3,
    alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border, overflow: "hidden",
  },
  tileImageActive: { borderColor: "transparent" },
  tileImg: { width: "100%", height: "100%" },
  // Pack shots carry wide white margins; zooming in fills the tile (the tile clips the overflow)
  tileZoom: { transform: [{ scale: 1.3 }] },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 14, color: colors.textSecondary, textAlign: "center", marginTop: 4, minHeight: 28 },
});
