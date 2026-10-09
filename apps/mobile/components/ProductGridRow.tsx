import { StyleSheet, View } from "react-native";
import type { ReactElement } from "react";
import type { StoreProduct } from "../lib/types";

interface ProductGridRowProps {
  items: StoreProduct[];
  columns: number;
  gap: number;
  cardWidth: number;
  renderCard: (item: StoreProduct) => ReactElement;
}

export function ProductGridRow({ items, columns, gap, cardWidth, renderCard }: ProductGridRowProps) {
  const spacers = Array.from({ length: columns - items.length }, (_, i) => i);
  return (
    <View style={[styles.row, { gap }]}>
      {items.map((item) => <View key={item.product.id}>{renderCard(item)}</View>)}
      {spacers.map((i) => <View key={`spacer-${i}`} style={{ width: cardWidth }} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
});
