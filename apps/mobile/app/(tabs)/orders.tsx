import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { colors, fonts } from "../../constants/theme";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { OrderCardSkeleton } from "../../components/SkeletonLoader";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";
import { withSignIn } from "../../components/SignInPrompt";
import { ActiveOrderCard } from "../../components/orders/ActiveOrderCard";
import { OrderHistoryCard } from "../../components/orders/OrderHistoryCard";
import { OrderFilterChips } from "../../components/orders/OrderFilterChips";
import { useOrdersFeed } from "../../components/orders/use-orders-feed";
import { useReorder } from "../../components/orders/use-reorder";
import { monthKey } from "../../components/orders/format";
import type { OrderFilter, OrderSummary } from "../../components/orders/types";

interface Section {
  key: string;
  title: string;
  active: boolean;
  data: OrderSummary[];
}

const EMPTY_COPY: Record<OrderFilter, { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = {
  ALL: { icon: "basket-outline", title: "No orders yet", body: "Your orders will show up here, with live tracking once they're on the way." },
  ACTIVE: { icon: "bicycle-outline", title: "Nothing on the way", body: "Orders you place will show here until they reach you." },
  DELIVERED: { icon: "checkmark-done-outline", title: "No delivered orders", body: "Orders you've received will show up here." },
  CANCELLED: { icon: "close-circle-outline", title: "No cancelled orders", body: "Good news: you haven't cancelled anything." },
};

function buildSections(filter: OrderFilter, active: OrderSummary[], history: OrderSummary[]): Section[] {
  const sections: Section[] = [];
  if (filter === "ALL" || filter === "ACTIVE") {
    if (active.length) sections.push({ key: "active", title: "In progress", active: true, data: active });
  }
  for (const order of history) {
    const title = monthKey(order.createdAt);
    const last = sections[sections.length - 1];
    if (last && !last.active && last.title === title) last.data.push(order);
    else sections.push({ key: title, title, active: false, data: [order] });
  }
  return sections;
}

function EmptyState({ filter, onShop }: { filter: OrderFilter; onShop: () => void }) {
  const copy = EMPTY_COPY[filter];
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={copy.icon} size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{copy.title}</Text>
      <Text style={styles.emptyBody}>{copy.body}</Text>
      {filter === "ALL" && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onShop}>
          <Text style={styles.emptyBtnText}>Start shopping</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, styles.errorIcon]}>
        <Ionicons name="cloud-offline-outline" size={32} color="#dc2626" />
      </View>
      <Text style={styles.emptyTitle}>Couldn't load your orders</Text>
      <Text style={styles.emptyBody}>Check your connection and try again.</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onRetry}>
        <Text style={styles.emptyBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrdersScreen() {
  const tabBarScroll = useTabBarAutoHide();
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const feed = useOrdersFeed(filter);
  const reorder = useReorder();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const sections = useMemo(() => buildSections(filter, feed.active, feed.history), [filter, feed.active, feed.history]);

  const openOrder = useCallback((id: string) => router.push(`/order/${id}`), [router]);
  const trackOrder = useCallback((id: string) => router.push({ pathname: "/live-tracking", params: { orderId: id } }), [router]);

  const confirmCancel = useCallback(async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await api.post(`/api/v1/orders/${cancelId}/cancel`, {});
      setCancelId(null);
      toast.show("Order cancelled", "success");
      feed.reload();
    } catch (err: any) {
      toast.show(err?.message ?? "Failed to cancel order", "error");
    } finally {
      setCancelling(false);
    }
  }, [cancelId, feed, toast]);

  const renderItem = useCallback(({ item, section }: { item: OrderSummary; section: Section }) => (
    section.active
      ? <ActiveOrderCard order={item} onOpen={openOrder} onTrack={trackOrder} onCancel={setCancelId} />
      : <OrderHistoryCard order={item} reordering={reorder.reorderingId === item.id} onOpen={openOrder} onReorder={reorder.reorder} />
  ), [openOrder, trackOrder, reorder.reorderingId, reorder.reorder]);

  return (
    <View style={styles.container}>
      <View>
        <OrderFilterChips value={filter} activeCount={feed.active.length} onChange={setFilter} />
      </View>
      {feed.phase === "loading" ? (
        <View style={styles.skeletons}>
          {[1, 2, 3].map((i) => <OrderCardSkeleton key={i} />)}
        </View>
      ) : feed.phase === "error" ? (
        <ErrorState onRetry={feed.retry} />
      ) : (
        <SectionList
          {...tabBarScroll.scrollProps}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.active && <Text style={styles.sectionHint}>Live updates</Text>}
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={tabBarScroll.contentStyle(sections.length ? styles.list : styles.listEmpty)}
          refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={colors.primary} />}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState filter={filter} onShop={() => router.push("/(tabs)")} />}
          ListFooterComponent={feed.loadingMore ? <ActivityIndicator style={styles.more} color={colors.primary} /> : null}
        />
      )}
      <ConfirmSheet
        visible={cancelId !== null}
        title="Cancel this order?"
        message="Any amount you paid will be refunded to your original payment method or wallet."
        icon="close-circle-outline"
        iconColor="#ef4444"
        confirmLabel="Yes, cancel"
        cancelLabel="Keep order"
        destructive
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => { if (!cancelling) setCancelId(null); }}
      />
      <ConfirmSheet
        visible={reorder.pending !== null}
        title="Replace your cart?"
        message={`Your cart has items from another store. Reordering clears it and adds items from ${reorder.pending?.store.name ?? "this store"}.`}
        icon="cart-outline"
        iconColor={colors.primary}
        confirmLabel="Replace cart"
        onConfirm={reorder.confirmReplace}
        onCancel={reorder.dismissReplace}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  skeletons: { padding: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 18, marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 },
  sectionHint: { fontSize: 12, fontFamily: fonts.medium, color: "#94a3b8" },
  more: { paddingVertical: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  errorIcon: { backgroundColor: "#fef2f2" },
  emptyTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.text, textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 12, height: 44, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center" },
  emptyBtnText: { fontSize: 14, fontFamily: fonts.bold, color: "#fff" },
});

export default withSignIn(OrdersScreen, { icon: "receipt-outline", title: "Your orders", message: "Sign in to see your orders and track deliveries." });
