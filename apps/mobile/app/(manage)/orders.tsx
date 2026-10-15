import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageHeader } from "../../components/manage/ManageHeader";
import { ConfirmDialog } from "../../components/manage/ui/ConfirmDialog";
import { manage } from "../../components/manage/ui/tokens";
import { BulkBar } from "../../components/manage/orders/BulkBar";
import { OrderToolbar } from "../../components/manage/orders/OrderToolbar";
import { OrdersList } from "../../components/manage/orders/OrdersList";
import { commonForwardStatus, useOrdersTab } from "../../components/manage/orders/use-orders-tab";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";

export default function ManageOrdersScreen() {
  const router = useRouter();
  const tab = useOrdersTab();
  const tabBarScroll = useTabBarAutoHide();
  const { selection, actions } = tab;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const selectedIds = selection.items.map((o) => o.id);

  const cancelSelected = async () => {
    await actions.bulkSetStatus(selectedIds, "CANCELLED");
    setConfirmCancel(false);
  };

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
        onAdvance={(o, next) => actions.setStatus(o.id, next)}
        scrollProps={tabBarScroll.scrollProps}
      />
      {selection.active && (
        <BulkBar
          selected={selection.items}
          nextStatus={commonForwardStatus(selection.items)}
          running={actions.running}
          onAdvance={(next) => actions.bulkSetStatus(selectedIds, next)}
          onCancel={() => setConfirmCancel(true)}
          onClear={selection.clear}
        />
      )}
      <ConfirmDialog
        visible={confirmCancel}
        title={`Cancel ${selection.items.length} orders?`}
        message="Reserved stock is released and customers are notified. This cannot be undone."
        confirmLabel="Yes, cancel orders"
        cancelLabel="Keep orders"
        running={actions.running}
        onConfirm={cancelSelected}
        onClose={() => setConfirmCancel(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
});
