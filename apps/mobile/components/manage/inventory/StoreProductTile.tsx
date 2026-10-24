import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage, tabular } from "../ui/tokens";
import { OfferPill } from "./OfferPill";
import { PhotoTile, photosOf } from "./ProductTile";
import { STOCK_STATE, stockState } from "./stock-status";
import type { StoreProductItem } from "./types";

/** The listed variant's own photo leads, then the product's */
export function listingPhotos(item: StoreProductItem): string[] {
  return [...new Set([item.variant.imageUrl, ...photosOf(item.product)].filter((u): u is string => !!u))];
}

/** A store listing as a grid tile: stock on the photo, pack size and selling price under the name */
export function StoreProductTile({ item, width, onPress }: { item: StoreProductItem; width: number; onPress: () => void }) {
  const sale = item.pricing.discountActive;
  const meta = (
    <View>
      <View style={styles.metaRow}>
        <Text style={styles.size} numberOfLines={1}>{`${item.variant.name} · `}</Text>
        <Text style={[styles.price, tabular]}>{formatINR(sale ? item.pricing.effectivePrice : item.price)}</Text>
        {sale && <Text style={[styles.mrp, tabular]}>{formatINR(item.price)}</Text>}
      </View>
      {item.pricing.offer && <View style={styles.offer}><OfferPill offer={item.pricing.offer} /></View>}
    </View>
  );
  const badge = <StatusPill {...STOCK_STATE[stockState(item.availableStock)]} label={`${item.availableStock} left`} />;

  return (
    <View>
      <PhotoTile name={item.product.name} photos={listingPhotos(item)} meta={meta} width={width} badge={badge} dimmed={!item.isActive} onPress={onPress} />
      {item.isFeatured && (
        <View style={styles.featured} accessibilityLabel="Featured">
          <Ionicons name="star" size={12} color={colors.accentText} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "baseline" },
  offer: { marginTop: 3 },
  size: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  price: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.text },
  mrp: { marginLeft: 4, fontFamily: fonts.medium, fontSize: 10.5, color: manage.muted, textDecorationLine: "line-through" },
  featured: {
    position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
  },
});
