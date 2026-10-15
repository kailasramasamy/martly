import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { ORDER_STATUS, formatINR, tabular } from "../ui/tokens";
import { timeAgo } from "../ui/dates";
import type { DashboardStats } from "./types";

interface TodayListsProps {
  stats: DashboardStats;
  onOpenOrder: (orderId: string) => void;
  onViewOrders: () => void;
}

export function TopProductsCard({ products }: { products: DashboardStats["topProducts"] }) {
  return (
    <SectionCard title="Top products · 7d" flush>
      {products.length === 0 ? (
        <Text style={styles.empty}>Delivered orders will rank your best sellers here.</Text>
      ) : (
        products.slice(0, 5).map((p, i) => (
          <View key={`${p.name}-${i}`} style={styles.product}>
            <Text style={[styles.rank, tabular]}>{i + 1}</Text>
            <View style={styles.productBody}>
              <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.productMeta}>{p.quantity} sold</Text>
            </View>
            <Text style={[styles.productValue, tabular]}>{formatINR(p.revenue)}</Text>
          </View>
        ))
      )}
    </SectionCard>
  );
}

export function RecentOrdersCard({ stats, onOpenOrder, onViewOrders }: TodayListsProps) {
  return (
    <SectionCard title="Recent orders" action={{ label: "View all", onPress: onViewOrders }} flush>
      {stats.recentOrders.length === 0 ? (
        <Text style={styles.empty}>No orders yet.</Text>
      ) : (
        stats.recentOrders.slice(0, 6).map((o) => (
          <ListRow
            key={o.id}
            title={`#${o.id.slice(0, 8)}`}
            subtitle={o.customerName}
            caption={timeAgo(o.createdAt)}
            value={formatINR(o.totalAmount)}
            trailing={<StatusPill {...ORDER_STATUS[o.status]} />}
            railColor={ORDER_STATUS[o.status]?.color}
            onPress={() => onOpenOrder(o.id)}
            chevron
          />
        ))
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, padding: 14, paddingTop: 8 },
  product: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rank: { width: 18, fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary },
  productBody: { flex: 1, minWidth: 0 },
  productName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  productMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  productValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
});
