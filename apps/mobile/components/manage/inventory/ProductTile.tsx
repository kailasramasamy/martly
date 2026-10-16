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

export function photosOf(p: { imageUrl: string | null; images: string[] }) {
  return [...new Set([p.imageUrl, ...p.images].filter((u): u is string => !!u))];
}

interface PhotoTileProps {
  name: string;
  photos: string[];
  /** Line under the name, e.g. "Brand · 2 sizes" */
  meta: ReactNode;
  width: number;
  /** Pinned to the photo's top-left corner, e.g. a StatusPill */
  badge?: ReactNode;
  /** Faded, e.g. an inactive product */
  dimmed?: boolean;
  onPress: () => void;
}

/** Photo-first grid card: swipeable shots, name and a meta line, with an optional badge on the photo */
export function PhotoTile({ name, photos, meta, width, badge, dimmed, onPress }: PhotoTileProps) {
  return (
    <View style={[styles.card, { width }, dimmed && styles.dimmed]}>
      <PhotoSwiper photos={photos} size={width} onPress={onPress} accessibilityLabel={name} />
      {badge && <View style={styles.badge}>{badge}</View>}
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2} onPress={onPress}>{name}</Text>
        {meta}
      </View>
    </View>
  );
}

type ProductTileProps = Omit<PhotoTileProps, "name" | "photos" | "meta"> & {
  /** organizationId: null = master catalog product, set = the organization's own; omitted = origin unknown */
  product: TileProduct & { organizationId?: string | null };
};

/** Catalog product as a PhotoTile: brand, then origin (master or local) and size count, under the name */
export function ProductTile({ product, ...rest }: ProductTileProps) {
  const sizes = product.variants.length;
  const local = !!product.organizationId;
  const meta = (
    <>
      {product.brand && <Text style={styles.meta} numberOfLines={1}>{product.brand.name}</Text>}
      <View style={styles.metaRow}>
        {product.organizationId !== undefined && (
          <Text style={[styles.meta, styles.origin, local ? styles.local : styles.master]}>{local ? "Local" : "Master"} · </Text>
        )}
        <Text style={styles.meta}>{`${sizes} size${sizes === 1 ? "" : "s"}`}</Text>
      </View>
    </>
  );
  return <PhotoTile name={product.name} photos={photosOf(product)} meta={meta} {...rest} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, overflow: "hidden" },
  dimmed: { opacity: 0.55 },
  badge: { position: "absolute", top: 6, left: 6 },
  text: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: colors.text, minHeight: 32 },
  metaRow: { flexDirection: "row" },
  origin: { fontFamily: fonts.semibold },
  master: { color: "#1d4ed8" },
  local: { color: "#6d28d9" },
  meta: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
});
