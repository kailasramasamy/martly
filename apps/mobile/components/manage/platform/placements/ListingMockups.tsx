import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PhoneFrame } from "./PhoneFrame";
import { Bar, BrandMark, BRAND_COLOR, CreativeFill, Highlight, ProductTile, SponsoredPill } from "./primitives";
import { usePreviewBrand } from "./preview-context";
import { colors, fonts } from "../../../../constants/theme";

export interface TileSpec { brand?: boolean; badge?: "Ad" | "Featured"; off?: string; lit?: boolean }

const plain: TileSpec = {};

/** Two-column grid; lit tiles get the highlight ring */
export function TileGrid({ tiles, imageHeight = 34 }: { tiles: TileSpec[]; imageHeight?: number }) {
  const rows: TileSpec[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.gridRow}>
          {row.map((t, c) => {
            const tile = <ProductTile brand={t.brand} badge={t.badge} off={t.off} imageHeight={imageHeight} />;
            return <View key={c} style={styles.cell}>{t.lit ? <Highlight style={styles.litTile}>{tile}</Highlight> : tile}</View>;
          })}
        </View>
      ))}
    </View>
  );
}

export const fill = (n: number, lit: Record<number, TileSpec>): TileSpec[] => Array.from({ length: n }, (_, i) => lit[i] ?? plain);

/** Category page: back header, subcategory rail on the left, content on the right */
export function CategoryScreen({ children }: { children: ReactNode }) {
  const { categoryName } = usePreviewBrand();
  return (
    <PhoneFrame>
      <View style={styles.catHeader}>
        <Ionicons name="chevron-back" size={12} color={colors.text} />
        {categoryName
          ? <Text style={styles.catTitle} numberOfLines={1}>{categoryName}</Text>
          : <Bar w={60} h={6} style={{ backgroundColor: "#cbd5e1" }} />}
      </View>
      <View style={styles.catBody}>
        <View style={styles.rail}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.railItem, i === 0 && styles.railActive]}>
              <View style={[styles.railDot, i === 0 && { backgroundColor: colors.primary }]} />
              <Bar w={20} h={3} />
            </View>
          ))}
        </View>
        <View style={styles.catContent}>{children}</View>
      </View>
    </PhoneFrame>
  );
}

/** The 2:1 strip at the top of a category page */
export function CategoryTakeoverMockup() {
  const { creativeUrl } = usePreviewBrand();
  return (
    <CategoryScreen>
      <Highlight style={styles.strip}>
        <View style={styles.stripInner}>
          {creativeUrl ? <CreativeFill /> : (
            <>
              <View style={{ flex: 1, gap: 4 }}>
                <Bar w="75%" h={6} style={styles.stripBar} />
                <Bar w="50%" h={4} style={styles.stripBar} />
              </View>
              <BrandMark size={28} round />
            </>
          )}
          <View style={styles.stripPill}><SponsoredPill /></View>
        </View>
      </Highlight>
      <TileGrid tiles={fill(6, {})} />
    </CategoryScreen>
  );
}

/** Category listing with the sponsored product second */
export function CategorySponsoredMockup() {
  return (
    <CategoryScreen>
      <TileGrid tiles={fill(8, { 1: { brand: true, badge: "Ad", lit: true } })} />
    </CategoryScreen>
  );
}

/** Category listing with Featured products at slots 1, 4 and 7 */
export function CategoryFeaturedMockup() {
  const featured: TileSpec = { brand: true, badge: "Featured", lit: true };
  return (
    <CategoryScreen>
      <TileGrid tiles={fill(8, { 0: featured, 3: featured, 6: featured })} imageHeight={26} />
    </CategoryScreen>
  );
}

/** Products wearing the brand's discount tag, wherever they appear */
export function DiscountGridMockup() {
  const { offLabel } = usePreviewBrand();
  const off: TileSpec = { brand: true, off: offLabel ?? "10% OFF", lit: true };
  return (
    <PhoneFrame>
      <View style={styles.discountBody}>
        <Bar w={80} h={6} style={{ backgroundColor: "#cbd5e1", marginBottom: 6 }} />
        <TileGrid tiles={fill(6, { 0: off, 3: off })} imageHeight={44} />
      </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 6 },
  gridRow: { flexDirection: "row", gap: 6 },
  cell: { flex: 1 },
  litTile: { borderRadius: 10 },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingBottom: 6 },
  catTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 9, color: colors.text },
  catBody: { flex: 1, flexDirection: "row" },
  rail: { width: 36, backgroundColor: "#f8fafc", paddingTop: 4, gap: 2 },
  railItem: { alignItems: "center", gap: 3, paddingVertical: 5 },
  railActive: { backgroundColor: "#ccfbf1" },
  railDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#e2e8f0" },
  catContent: { flex: 1, padding: 6, gap: 8 },
  strip: { height: 66, marginTop: 4 },
  stripInner: { flex: 1, backgroundColor: BRAND_COLOR, borderRadius: 10, padding: 8, flexDirection: "row", alignItems: "center", gap: 6, overflow: "hidden" },
  stripBar: { backgroundColor: "rgba(255,255,255,0.85)" },
  stripPill: { position: "absolute", top: 4, left: 4 },
  discountBody: { padding: 8, paddingTop: 10 },
});
