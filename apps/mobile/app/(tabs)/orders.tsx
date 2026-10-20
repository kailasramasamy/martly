import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { strings, type Strings } from "../../lib/i18n";
import { useStrings } from "../../lib/i18n/use-strings";
import { colors, fonts } from "../../constants/theme";
import { OrderCardSkeleton } from "../../components/SkeletonLoader";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";
import { withSignIn } from "../../components/SignInPrompt";
import { OrderRow } from "../../components/orders/OrderRow";
import { OrderFilterChips } from "../../components/orders/OrderFilterChips";
import { useOrdersFeed } from "../../components/orders/use-orders-feed";
import { monthKey } from "../../components/orders/format";
import type { OrderFilter, OrderSummary } from "../../components/orders/types";

interface Section {
  key: string;
  title: string;
  active: boolean;
  data: OrderSummary[];
}

function emptyCopy(t: Strings<"orders">["tab"]): Record<OrderFilter, { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> {
  return {
    ALL: { icon: "basket-outline", title: t.emptyAllTitle, body: t.emptyAllBody },
    ACTIVE: { icon: "bicycle-outline", title: t.emptyActiveTitle, body: t.emptyActiveBody },
    DELIVERED: { icon: "checkmark-done-outline", title: t.emptyDeliveredTitle, body: t.emptyDeliveredBody },
    CANCELLED: { icon: "close-circle-outline", title: t.emptyCancelledTitle, body: t.emptyCancelledBody },
  };
}

function buildSections(filter: OrderFilter, active: OrderSummary[], history: OrderSummary[], inProgress: string): Section[] {
  const sections: Section[] = [];
  if (filter === "ALL" || filter === "ACTIVE") {
    if (active.length) sections.push({ key: "active", title: inProgress, active: true, data: active });
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
  const t = useStrings("orders").tab;
  const copy = emptyCopy(t)[filter];
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={copy.icon} size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{copy.title}</Text>
      <Text style={styles.emptyBody}>{copy.body}</Text>
      {filter === "ALL" && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onShop}>
          <Text style={styles.emptyBtnText}>{t.startShopping}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useStrings("orders").tab;
  const common = useStrings("common");
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, styles.errorIcon]}>
        <Ionicons name="cloud-offline-outline" size={32} color="#dc2626" />
      </View>
      <Text style={styles.emptyTitle}>{t.loadErrorTitle}</Text>
      <Text style={styles.emptyBody}>{t.loadErrorBody}</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onRetry}>
        <Text style={styles.emptyBtnText}>{common.retry}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrdersScreen() {
  const tabBarScroll = useTabBarAutoHide();
  const router = useRouter();
  const t = useStrings("orders").tab;
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const feed = useOrdersFeed(filter);

  const sections = useMemo(() => buildSections(filter, feed.active, feed.history, t.inProgress), [filter, feed.active, feed.history, t.inProgress]);

  const openOrder = useCallback((id: string) => router.push(`/order/${id}`), [router]);
  const trackOrder = useCallback((id: string) => router.push({ pathname: "/live-tracking", params: { orderId: id } }), [router]);

  const renderItem = useCallback(({ item, section }: { item: OrderSummary; section: Section }) => (
    <OrderRow order={item} active={section.active} onOpen={openOrder} onTrack={trackOrder} />
  ), [openOrder, trackOrder]);

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
          ItemSeparatorComponent={RowDivider}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.active && <Text style={styles.sectionHint}>{t.liveUpdates}</Text>}
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
    </View>
  );
}

// Rows run edge to edge like a list, the divider inset to the text so pictures stack cleanly
const RowDivider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  skeletons: { padding: 16 },
  list: { paddingBottom: 24 },
  divider: { height: 1, marginLeft: 102, backgroundColor: colors.border },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 18, marginBottom: 10, paddingHorizontal: 18 },
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

export default withSignIn(OrdersScreen, "receipt-outline", () => ({
  title: strings("orders").tab.signInTitle,
  message: strings("orders").tab.signInMessage,
}));
