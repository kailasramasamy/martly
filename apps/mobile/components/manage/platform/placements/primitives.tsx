import type { ReactNode } from "react";
import { View, Text, Image, StyleSheet, type StyleProp, type ViewStyle, type DimensionValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { usePreviewBrand } from "./preview-context";

export const BRAND_COLOR = "#f97316";
export const BRAND_TINT = "#ffedd5";
const GREY = "#e2e8f0";
const GREY_SOFT = "#f1f5f9";

/** A skeleton text line */
export function Bar({ w = "100%", h = 5, style }: { w?: DimensionValue; h?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: w, height: h, borderRadius: h / 2, backgroundColor: GREY }, style]} />;
}

/** A neutral skeleton block */
export function Box({ h, w, r = 8, style, children }: { h: number; w?: DimensionValue; r?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[{ height: h, width: w, borderRadius: r, backgroundColor: GREY_SOFT }, style]}>{children}</View>;
}

/** Ring and glow around the element the brand pays for, with a small callout */
export function Highlight({ children, label = "Your ad", style }: { children: ReactNode; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.ring, style]}>
      {children}
      <View style={styles.callout}><Text style={styles.calloutText}>{label}</Text></View>
    </View>
  );
}

export function SponsoredPill() {
  return <View style={styles.sponsored}><Text style={styles.sponsoredText}>Sponsored</Text></View>;
}

/** The campaign's creative filling its slot, when there is one */
export function CreativeFill() {
  const { creativeUrl } = usePreviewBrand();
  return creativeUrl ? <Image source={{ uri: creativeUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null;
}

/** The brand's logo when known, else a placeholder block */
export function BrandMark({ size = 22, round }: { size?: number; round?: boolean }) {
  const { logoUrl } = usePreviewBrand();
  const shape = { width: size, height: size, borderRadius: round ? size / 2 : size / 4 };
  if (logoUrl) return <Image source={{ uri: logoUrl }} style={[styles.mark, styles.markLogo, shape]} resizeMode="contain" />;
  return (
    <View style={[styles.mark, shape]}>
      <Text style={[styles.markText, { fontSize: Math.max(5, size / 4.2) }]}>BRAND</Text>
    </View>
  );
}

type TileBadge = "Ad" | "Featured";

interface TileProps { brand?: boolean; badge?: TileBadge; off?: string; imageHeight?: number }

/** Product card as in the shopper grid; `brand` colours the image */
export function ProductTile({ brand, badge, off, imageHeight = 38 }: TileProps) {
  const { productImageUrl, logoUrl } = usePreviewBrand();
  return (
    <View style={styles.tile}>
      <View style={[styles.tileImage, { height: imageHeight }, brand && { backgroundColor: BRAND_TINT }]}>
        {brand ? <TileArt productImageUrl={productImageUrl} logoUrl={logoUrl} /> : null}
        {badge ? <View style={[styles.badge, badge === "Featured" && styles.badgeFeatured]}><Text style={[styles.badgeText, badge === "Featured" && styles.badgeTextFeatured]}>{badge}</Text></View> : null}
        {off ? <View style={styles.off}><Text style={styles.offText}>{off}</Text></View> : null}
      </View>
      <Bar w="80%" h={4} style={styles.tileLine} />
      <View style={styles.tileFoot}>
        <Bar w="38%" h={5} style={{ backgroundColor: "#cbd5e1" }} />
        <View style={styles.add}><Ionicons name="add" size={9} color={colors.primary} /></View>
      </View>
    </View>
  );
}

function TileArt({ productImageUrl, logoUrl }: { productImageUrl?: string | null; logoUrl?: string | null }) {
  if (productImageUrl) return <Image source={{ uri: productImageUrl }} style={styles.tilePhoto} resizeMode="cover" />;
  if (logoUrl) return <Image source={{ uri: logoUrl }} style={styles.tileLogo} resizeMode="contain" />;
  return <Ionicons name="cube" size={16} color={BRAND_COLOR} />;
}

export function SearchBar({ text }: { text?: string }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={10} color="#94a3b8" />
      {text ? <Text style={styles.searchText}>{text}</Text> : <Bar w="45%" h={4} />}
    </View>
  );
}

export function HomeHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ gap: 3 }}><Bar w={26} h={4} /><Bar w={64} h={6} style={{ backgroundColor: "#cbd5e1" }} /></View>
        <View style={styles.avatar} />
      </View>
      <SearchBar />
    </View>
  );
}

export function FestiveHero() {
  return (
    <View style={styles.festive}>
      <Bar w="50%" h={6} style={{ backgroundColor: "#fcd34d" }} />
      <Bar w="32%" h={4} style={{ backgroundColor: "#fde68a" }} />
    </View>
  );
}

/** Carousel slide as HeroBannerSlide draws it */
export function BrandSlide({ height = 78 }: { height?: number }) {
  const { creativeUrl } = usePreviewBrand();
  return (
    <View style={[styles.slide, { height }]}>
      {creativeUrl ? <CreativeFill /> : (
        <>
          <View style={{ gap: 4, flex: 1 }}>
            <Bar w="70%" h={6} style={styles.slideBar} />
            <Bar w="45%" h={4} style={styles.slideBar} />
            <View style={styles.slideCta}><Text style={styles.slideCtaText}>Shop now</Text></View>
          </View>
          <BrandMark size={34} round />
        </>
      )}
      <View style={styles.slidePill}><SponsoredPill /></View>
    </View>
  );
}

export function Dots() {
  return (
    <View style={styles.dots}>
      <View style={[styles.dot, { backgroundColor: colors.primary, width: 10 }]} />
      <View style={styles.dot} /><View style={styles.dot} />
    </View>
  );
}

export function SectionTitle({ w = 70 }: { w?: number }) {
  return <Bar w={w} h={6} style={{ backgroundColor: "#cbd5e1", marginTop: 4 }} />;
}

/** Row of product tiles, clipped by the phone edge */
export function TileRow({ count = 3, imageHeight = 34 }: { count?: number; imageHeight?: number }) {
  return (
    <View style={styles.tileRow}>
      {Array.from({ length: count }, (_, i) => <View key={i} style={styles.rowTile}><ProductTile imageHeight={imageHeight} /></View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: 12, borderWidth: 2, borderColor: colors.primary, padding: 0,
    shadowColor: colors.primaryLight, shadowOpacity: 0.9, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  callout: { position: "absolute", top: -9, right: 8, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5 },
  calloutText: { fontFamily: fonts.bold, fontSize: 8, color: "#ffffff" },
  sponsored: { backgroundColor: "rgba(15,23,42,0.55)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  sponsoredText: { fontFamily: fonts.semibold, fontSize: 6.5, color: "#ffffff" },
  mark: { backgroundColor: BRAND_COLOR, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#ffffff" },
  markLogo: { backgroundColor: "#ffffff" },
  markText: { fontFamily: fonts.extrabold, color: "#ffffff", letterSpacing: 0.3 },
  // No flex here: in a stacked grid cell it would collapse the tile; rows give each tile a flex wrapper instead
  tile: { backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: GREY, padding: 4, gap: 3 },
  tileImage: { borderRadius: 6, overflow: "hidden", backgroundColor: GREY_SOFT, alignItems: "center", justifyContent: "center" },
  tilePhoto: { ...StyleSheet.absoluteFillObject, borderRadius: 6 },
  tileLogo: { width: "62%", height: "62%" },
  tileLine: { marginTop: 1 },
  tileFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  add: { width: 13, height: 13, borderRadius: 4, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 2, left: 2, backgroundColor: "#94a3b8", borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0.5 },
  badgeFeatured: { backgroundColor: colors.primary },
  badgeText: { fontFamily: fonts.bold, fontSize: 6, color: "#ffffff" },
  badgeTextFeatured: { color: "#ffffff" },
  off: { position: "absolute", top: 2, right: 2, backgroundColor: colors.salePill, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0.5 },
  offText: { fontFamily: fonts.extrabold, fontSize: 6, color: colors.salePillText },
  search: { height: 22, borderRadius: 11, backgroundColor: GREY_SOFT, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8 },
  searchText: { fontFamily: fonts.medium, fontSize: 9, color: colors.text },
  header: { gap: 6, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: GREY },
  festive: { height: 58, borderRadius: 10, backgroundColor: "#fef3c7", padding: 10, gap: 5, justifyContent: "center", marginHorizontal: 8 },
  slide: { borderRadius: 10, overflow: "hidden", backgroundColor: BRAND_COLOR, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  slideBar: { backgroundColor: "rgba(255,255,255,0.85)" },
  slideCta: { alignSelf: "flex-start", backgroundColor: "#ffffff", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  slideCtaText: { fontFamily: fonts.bold, fontSize: 6.5, color: BRAND_COLOR },
  slidePill: { position: "absolute", top: 5, left: 5 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 3, marginTop: 5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#cbd5e1" },
  tileRow: { flexDirection: "row", gap: 5 },
  rowTile: { flex: 1 },
});
