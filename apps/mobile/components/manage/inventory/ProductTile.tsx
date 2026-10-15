import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { PhotoSwiper } from "./PhotoSwiper";

interface TileProduct {
  name: string;
  imageUrl: string | null;
  images: string[];
  brand: { name: string } | null;
  variants: unknown[];
}

interface ProductTileProps {
  product: TileProduct;
  width: number;
  /** Pinned to the photo's top-left corner, e.g. a StatusPill */
  badge?: ReactNode;
  /** Faded, e.g. an inactive product */
  dimmed?: boolean;
  onPress: () => void;
}

export function photosOf(p: TileProduct) {
  return [...new Set([p.imageUrl, ...p.images].filter((u): u is string => !!u))];
}

/** Photo-first grid card: swipeable shots, name, brand and size count, with an optional badge on the photo */
export function ProductTile({ product, width, badge, dimmed, onPress }: ProductTileProps) {
  const sizes = product.variants.length;
  return (
    <View style={[styles.card, { width }, dimmed && styles.dimmed]}>
      <PhotoSwiper photos={photosOf(product)} size={width} onPress={onPress} accessibilityLabel={product.name} />
      {badge && <View style={styles.badge}>{badge}</View>}
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2} onPress={onPress}>{product.name}</Text>
        <View style={styles.metaRow}>
          {product.brand && <Text style={[styles.meta, styles.brand]} numberOfLines={1}>{product.brand.name} · </Text>}
          <Text style={styles.meta}>{`${sizes} size${sizes === 1 ? "" : "s"}`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, overflow: "hidden" },
  dimmed: { opacity: 0.55 },
  badge: { position: "absolute", top: 6, left: 6 },
  text: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: colors.text, minHeight: 32 },
  metaRow: { flexDirection: "row" },
  brand: { flexShrink: 1 },
  meta: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
});
