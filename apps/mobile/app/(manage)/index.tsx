import { useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Permission } from "@martly/shared/constants";
import { can, hasPermission } from "@martly/shared/permissions";
import { fonts } from "../../constants/theme";
import { useAuth } from "../../lib/auth-context";
import { useManageScope } from "../../lib/manage-scope-context";
import { requestOrdersFilter } from "../../lib/manage/use-live-orders";
import { ManageScreen } from "../../components/manage/ManageScreen";
import { SectionCard } from "../../components/manage/ui/SectionCard";
import { EmptyState } from "../../components/manage/ui/EmptyState";
import { formatINR, manage } from "../../components/manage/ui/tokens";
import { fromDateKey } from "../../components/manage/ui/dates";
import { BarChart } from "../../components/manage/today/BarChart";
import { TodayKpis } from "../../components/manage/today/TodayKpis";
import { LiveQueue, QUEUE_STATUSES } from "../../components/manage/today/LiveQueue";
import { LowStockCard } from "../../components/manage/today/LowStockCard";
import { CountsWaitingCard } from "../../components/manage/stock/CountsWaitingCard";
import { RecentOrdersCard, TopProductsCard } from "../../components/manage/today/TodayLists";
import { useTodayData } from "../../components/manage/today/use-today-data";
import { useStatusCounts } from "../../components/manage/orders/use-status-counts";

function Greeting({ name }: { name?: string }) {
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const first = name?.split(" ")[0];
  const date = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  return (
    <View style={styles.greeting}>
      <Text style={styles.greetingTitle}>{first ? `Good ${part}, ${first}` : `Good ${part}`}</Text>
      <Text style={styles.greetingDate}>{date}</Text>
    </View>
  );
}

/** Members without reports land on their first available tab instead */
export default function ManageTodayScreen() {
  const { user } = useAuth();
  if (user?.role === "SUPER_ADMIN" || hasPermission(user?.permissions, Permission.REPORTS_VIEW)) return <TodayDashboard />;
  if (hasPermission(user?.permissions, Permission.ORDERS_VIEW)) return <Redirect href="/(manage)/orders" />;
  if (hasPermission(user?.permissions, Permission.DELIVERY_DELIVER)) return <Redirect href="/(manage)/delivery" />;
  return <Redirect href={can(user, "store-products", "list") ? "/(manage)/catalog" : "/(manage)/more"} />;
}

function TodayDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, loading: scopeLoading, stores } = useManageScope();
  const { stats, stock, lowItems, loading, refreshing, error, refresh } = useTodayData(storeId, !scopeLoading && stores.length > 0);
  const { counts, reload: reloadCounts } = useStatusCounts(QUEUE_STATUSES, storeId);
  // Coming back to Today refreshes the live queue counts
  useFocusEffect(useCallback(() => { reloadCounts(); }, [reloadCounts]));

  const openOrders = (status?: string) => {
    if (status) requestOrdersFilter(status);
    router.navigate("/(manage)/orders");
  };
  const weekdays = (stats?.revenueOverTime ?? []).map((d) => ({
    label: fromDateKey(d.date).toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 3),
    value: d.revenue,
  }));

  return (
    <ManageScreen title="Today" headerContent={<Greeting name={user?.name} />} refreshing={refreshing} onRefresh={() => { refresh(); reloadCounts(); }}>
      {!scopeLoading && stores.length === 0 ? (
        <EmptyState icon="storefront-outline" title="No stores yet" message="Ask an admin to assign you to a store." />
      ) : scopeLoading || loading ? (
        <EmptyState icon="pulse-outline" title="Loading today" message="Pulling in your latest numbers." />
      ) : error || !stats || !stock ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load today" message={error ?? undefined} action={{ label: "Try again", onPress: refresh }} />
      ) : (
        <>
          <TodayKpis stats={stats} />
          <SectionCard title="Live queue" action={{ label: "All orders", onPress: () => openOrders() }}>
            <LiveQueue counts={counts} onSelect={openOrders} />
          </SectionCard>
          <CountsWaitingCard storeId={storeId} />
          <SectionCard title="Revenue · last 7 days">
            <BarChart data={weekdays} formatValue={(v) => formatINR(v)} />
          </SectionCard>
          <LowStockCard stock={stock} items={lowItems} onViewAll={() => router.navigate("/(manage)/catalog")} />
          <TopProductsCard products={stats.topProducts} />
          <RecentOrdersCard stats={stats} onOpenOrder={(id) => router.push(`/manage/orders/${id}`)} onViewOrders={() => openOrders()} />
        </>
      )}
    </ManageScreen>
  );
}

const styles = StyleSheet.create({
  greeting: { marginTop: 4 },
  greetingTitle: { fontFamily: fonts.semibold, fontSize: 14, color: manage.inkText },
  greetingDate: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.inkMuted, marginTop: 2 },
});
