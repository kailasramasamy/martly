import { useEffect, useState, type ReactNode } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { brandDisplayName, brandTheme } from "../lib/brand-strip";
import type { BrandInfo } from "./BrandStoreHeader";

const COMPACT_ROW = 52;

interface Props {
  brand: BrandInfo;
  scrollY: Animated.Value;
  // Scrolls away: the hero and category tiles
  expanded: ReactNode;
  // Stays pinned under the compact bar: the subcategory chips
  pinned?: ReactNode;
  // Total header height, so the content below can pad itself to start underneath it
  onHeight: (height: number) => void;
  onSearchPress: () => void;
}

// Brand header that slides away as the content scrolls, leaving a compact brand bar plus the pinned row
export function CollapsingBrandHeader({ brand, scrollY, expanded, pinned, onHeight, onSearchPress }: Props) {
  const insets = useSafeAreaInsets();
  const [expandedHeight, setExpandedHeight] = useState(0);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const compactHeight = insets.top + COMPACT_ROW;
  const distance = Math.max(1, expandedHeight - compactHeight);

  useEffect(() => onHeight(expandedHeight + (pinned ? pinnedHeight : 0)), [expandedHeight, pinnedHeight, pinned, onHeight]);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setCollapsed(value > distance - 24));
    return () => scrollY.removeListener(id);
  }, [scrollY, distance]);

  const translateY = scrollY.interpolate({ inputRange: [0, distance], outputRange: [0, -distance], extrapolate: "clamp" });
  const compactOpacity = scrollY.interpolate({ inputRange: [Math.max(0, distance - 60), distance], outputRange: [0, 1], extrapolate: "clamp" });

  return (
    <>
      <Animated.View style={[styles.stack, { transform: [{ translateY }] }]}>
        <View onLayout={(e) => setExpandedHeight(e.nativeEvent.layout.height)}>{expanded}</View>
        {pinned && <View onLayout={(e) => setPinnedHeight(e.nativeEvent.layout.height)}>{pinned}</View>}
      </Animated.View>
      <Animated.View
        style={[styles.compact, { height: compactHeight, opacity: compactOpacity }]}
        pointerEvents={collapsed ? "auto" : "none"}
      >
        <CompactBar brand={brand} top={insets.top} onSearchPress={onSearchPress} />
      </Animated.View>
    </>
  );
}

function CompactBar({ brand, top, onSearchPress }: { brand: BrandInfo; top: number; onSearchPress: () => void }) {
  const { base, dark } = brandTheme(brand);
  const name = brandDisplayName(brand.name);
  return (
    <LinearGradient colors={[base, dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.compactInner, { paddingTop: top }]}>
      <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>
      <View style={styles.miniLogo}>
        {brand.imageUrl ? <Image source={{ uri: brand.imageUrl }} style={styles.miniLogoImg} resizeMode="contain" /> : null}
      </View>
      <Text style={styles.compactName} numberOfLines={1}>{name}</Text>
      <Pressable style={styles.iconBtn} onPress={onSearchPress} hitSlop={8} accessibilityLabel={`Search in ${name}`}>
        <Ionicons name="search" size={20} color="#fff" />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  stack: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, backgroundColor: "#fff" },
  compact: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 3 },
  compactInner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  miniLogo: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#fff", padding: 3 },
  miniLogoImg: { width: "100%", height: "100%" },
  compactName: { flex: 1, fontFamily: fonts.extrabold, fontSize: 18, color: "#fff", letterSpacing: -0.3 },
});
