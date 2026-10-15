import { View, StyleSheet } from "react-native";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage } from "../ui/tokens";
import { STOCK_STATE, stockState } from "./stock-status";
import type { StoreProductItem } from "./types";

const FEATURED = { label: "Featured", color: manage.attentionText, bg: manage.attentionBg };
const UNLISTED = { label: "Unlisted", color: "#475569", bg: "#e2e8f0" };

export function StoreProductListRow({ item, onPress }: { item: StoreProductItem; onPress: () => void }) {
  const state = stockState(item.availableStock);
  const sale = item.pricing.discountActive;
  const image = item.variant.imageUrl ?? item.product.imageUrl ?? item.product.images[0] ?? null;
  const price = formatINR(sale ? item.pricing.effectivePrice : item.price, { decimals: true });

  return (
    <ListRow
      title={item.product.name}
      subtitle={item.variant.name}
      caption={sale ? `MRP ${formatINR(item.price, { decimals: true })}` : undefined}
      value={price}
      imageUrl={image}
      railColor={STOCK_STATE[state].color}
      onPress={onPress}
      trailing={
        <View style={styles.trailing}>
          <StatusPill {...STOCK_STATE[state]} label={`${item.availableStock} left`} />
          <View style={styles.badges}>
            {!item.isActive && <StatusPill {...UNLISTED} />}
            {item.isFeatured && <StatusPill {...FEATURED} />}
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  trailing: { alignItems: "flex-end", gap: 4 },
  badges: { flexDirection: "row", gap: 4 },
});
