import { View, StyleSheet } from "react-native";
import { KpiTile } from "../ui/KpiTile";
import { formatINR } from "../ui/tokens";
import { percentChange, type DashboardStats } from "./types";

function lastTwo(values: number[]): [number, number] {
  return [values[values.length - 1] ?? 0, values[values.length - 2] ?? 0];
}

export function TodayKpis({ stats }: { stats: DashboardStats }) {
  const { kpis } = stats;
  const revenue = stats.revenueOverTime.map((d) => d.revenue);
  const orders = stats.ordersOverTime.map((d) => d.count);
  const [todayRevenue, yesterdayRevenue] = lastTwo(revenue);
  const [todayOrders, yesterdayOrders] = lastTwo(orders);

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <KpiTile label="Today's revenue" value={formatINR(todayRevenue)} deltaPct={percentChange(todayRevenue, yesterdayRevenue)} trend={revenue} />
        <KpiTile label="Today's orders" value={String(todayOrders)} deltaPct={percentChange(todayOrders, yesterdayOrders)} trend={orders} />
      </View>
      <View style={styles.row}>
        <KpiTile label="Avg order value · 7d" value={formatINR(kpis.averageOrderValue)} deltaPct={percentChange(kpis.averageOrderValue, kpis.previousAOV)} />
        <KpiTile label="Customers · 7d" value={String(kpis.totalCustomers)} deltaPct={percentChange(kpis.totalCustomers, kpis.previousCustomers)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
});
