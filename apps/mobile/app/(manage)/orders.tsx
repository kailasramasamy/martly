import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageHeader } from "../../components/manage/ManageHeader";
import { manage } from "../../components/manage/ui/tokens";
import { BulkBar } from "../../components/manage/orders/BulkBar";
import { OrderToolbar } from "../../components/manage/orders/OrderToolbar";
import { OrdersList } from "../../components/manage/orders/OrdersList";
import { bulkStep } from "@martly/shared/order-flow";
import { useOrdersTab } from "../../components/manage/orders/use-orders-tab";
import { useAdvanceStep } from "../../components/manage/orders/use-advance-step";
import type { OrderListItem } from "../../components/manage/orders/types";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";
import { TabBottomDock } from "../../components/TabIcon";
import { useAuth } from "../../lib/auth-context";

export default function ManageOrdersScreen() {
  const router = useRouter();
  const tab = useOrdersTab();
  const tabBarScroll = useTabBarAutoHide();
  // Height of the bulk bar docked above the tab bar, so the list scrolls clear of it
  const [dockHeight, setDockHeight] = useState(0);
  const { user } = useAuth();
  const { selection, actions } = tab;
  const selectedIds = selection.items.map((o) => o.id);
  const bulk = bulkStep(user, selection.items);
  const step = useAdvanceStep((o: OrderListItem, status: string) => actions.setStatus(o.id, status), tab.list.refresh, actions.running);

  return (
    <View style={styles.root}>
      <ManageHeader title="Orders" collapsed={tabBarScroll.headerCollapsed} />
      <OrderToolbar query={tab.query} onQuery={tab.setQuery} status={tab.status} onStatus={tab.setStatus} counts={tab.counts} />
      <OrdersList
        list={{ ...tab.list, loading: tab.list.loading || tab.scopeLoading }}
        selected={selection.selected}
        searching={!!tab.query}
        onOpen={(o) => router.push(`/manage/orders/${o.id}`)}
        onSelect={selection.toggle}
        onAdvance={step.advance}
        scrollProps={tabBarScroll.scrollProps}
        contentContainerStyle={tabBarScroll.contentStyle(undefined, selection.active ? dockHeight : 0)}
      />
      {selection.active && (
        <TabBottomDock onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}>
        <BulkBar
          selected={selection.items}
          nextStatus={bulk.next}
          hint={bulk.hint}
          running={actions.running}
          onAdvance={(next) => actions.bulkSetStatus(selectedIds, next)}
          onClear={selection.clear}
        />
        </TabBottomDock>
      )}
      {step.overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
});
