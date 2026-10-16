import { View, StyleSheet } from "react-native";
import { ManageScreen } from "../ManageScreen";
import { manage } from "../ui/tokens";
import { DateBar } from "./DateBar";
import { DeliveryContent } from "./DeliveryBody";
import { boardSubtitle } from "./groups";
import { DispatchOverlays } from "./DispatchOverlays";
import { useDispatchDesk } from "./use-dispatch-desk";
import { useDispatchAccess } from "./use-dispatch-access";

/** A rider's Delivery tab: their own trips. Phase 3 rebuilds this. */
export function RiderDelivery() {
  const desk = useDispatchDesk();
  const { storeId, data, filters, selection } = desk;
  const { canDispatch, userId } = useDispatchAccess();
  return (
    <View style={styles.root}>
      <ManageScreen
        title="My trips"
        headerSubtitle={boardSubtitle(data.board, data.trips, userId, true)}
        refreshing={data.refreshing}
        onRefresh={storeId ? data.refresh : undefined}
        dockHeight={selection.selected.size > 0 ? desk.dockHeight : 0}
      >
        {storeId ? <DateBar value={desk.date} onChange={desk.changeDate} /> : null}
        <DeliveryContent
          storeId={storeId}
          scopeLoading={desk.scopeLoading}
          loading={data.loading}
          error={data.error}
          board={data.board}
          trips={data.trips}
          view=""
          selected={selection.selected}
          onToggle={selection.toggle}
          onMenu={desk.setMenuOrder}
          onChanged={data.reloadQuietly}
          onRetry={data.refresh}
        />
      </ManageScreen>
      <DispatchOverlays
        storeId={storeId}
        canDispatch={canDispatch}
        selected={selection.selected}
        onClearSelection={selection.clear}
        onDockHeight={desk.setDockHeight}
        assigning={desk.assigning}
        onAssigning={desk.setAssigning}
        onTripCreated={desk.tripCreated}
        onManageRiders={desk.openRiders}
        menuOrder={desk.menuOrder}
        onMenuClose={() => desk.setMenuOrder(null)}
        onChanged={data.reloadQuietly}
        filterPicker={filters.picker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
});
