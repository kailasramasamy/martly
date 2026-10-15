import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { manage, tabular } from "../ui/tokens";
import type { LowStockItem, StockSummary } from "./types";

interface LowStockCardProps {
  stock: StockSummary;
  items: LowStockItem[];
  onViewAll: () => void;
}

export function LowStockCard({ stock, items, onViewAll }: LowStockCardProps) {
  const { lowStock, outOfStock } = stock.totals;
  const alerts = lowStock + outOfStock;

  return (
    <SectionCard title="Stock alerts" action={alerts > 0 ? { label: "View all", onPress: onViewAll } : undefined} flush>
      <View style={styles.summary}>
        <Text style={[styles.big, tabular, alerts > 0 && styles.bigAttention]}>{alerts}</Text>
        <Text style={styles.caption}>
          {alerts === 0 ? "Everything is well stocked" : `${lowStock} running low · ${outOfStock} out of stock`}
        </Text>
      </View>
      {items.map((item) => (
        <ListRow
          key={item.id}
          title={item.product.name}
          subtitle={item.variant.name}
          value={`${item.stock - item.reservedStock} left`}
          railColor={manage.attention}
        />
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12 },
  big: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.6 },
  bigAttention: { color: manage.attentionText },
  caption: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
