import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { StatusPill } from "../ui/StatusPill";
import { formatINR } from "../ui/tokens";
import { PhotoGallery } from "./PhotoGallery";
import { STOCK_STATE, stockState } from "./stock-status";
import { listingPhotos } from "./StoreProductTile";
import type { StoreProductItem } from "./types";

/** Listing identity: swipeable photos, brand, name, pack size, MRP, store and live stock state */
export function ListingHeader({ item, available }: { item: StoreProductItem; available: number }) {
  const mrp = item.variant.mrp ? Number(item.variant.mrp) : null;
  return (
    <View style={styles.root}>
      <PhotoGallery photos={listingPhotos(item)} name={item.product.name} />
      <View style={styles.text}>
        {item.product.brand ? <Text style={styles.brand} numberOfLines={1}>{item.product.brand.name}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.variant.name}{mrp ? ` · MRP ${formatINR(mrp)}` : ""}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>{item.store.name}</Text>
        <StatusPill {...STOCK_STATE[stockState(available)]} dot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  text: { gap: 3, alignItems: "flex-start" },
  brand: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8, textTransform: "uppercase" },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
