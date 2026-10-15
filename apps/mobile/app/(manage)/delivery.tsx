import { useCallback, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { can } from "@martly/shared/permissions";
import { fonts } from "../../constants/theme";
import { useAuth } from "../../lib/auth-context";
import { useManageScope } from "../../lib/manage-scope-context";
import { useOrderWebSocket } from "../../lib/useOrderWebSocket";
import { ManageScreen } from "../../components/manage/ManageScreen";
import { manage } from "../../components/manage/ui/tokens";
import { toDateKey } from "../../components/manage/ui/dates";
import { AssignRiderSheet } from "../../components/manage/delivery/AssignRiderSheet";
import { DateBar } from "../../components/manage/delivery/DateBar";
import { DeliveryContent } from "../../components/manage/delivery/DeliveryBody";
import { OrderActionSheet } from "../../components/manage/delivery/OrderActionSheet";
import { SelectionBar } from "../../components/manage/delivery/SelectionBar";
import { readyCount } from "../../components/manage/delivery/groups";
import { useSelection } from "../../components/manage/delivery/use-selection";
import { useDeliveryBoard } from "../../components/manage/delivery/use-delivery-board";
import type { BoardOrder } from "../../components/manage/delivery/types";

function RidersLink({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.riders} onPress={onPress} accessibilityRole="button" accessibilityLabel="Riders" activeOpacity={0.8}>
      <Ionicons name="bicycle-outline" size={16} color={manage.inkText} />
      <Text style={styles.ridersLabel}>Riders</Text>
    </TouchableOpacity>
  );
}

export default function ManageDeliveryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, loading: scopeLoading } = useManageScope();
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [menuOrder, setMenuOrder] = useState<BoardOrder | null>(null);
  const [assigning, setAssigning] = useState(false);
  const { selected, toggle, clear } = useSelection();
  const { board, trips, loading, refreshing, error, refresh, reloadQuietly } = useDeliveryBoard(storeId, date);

  useOrderWebSocket({ onOrdersChanged: useCallback(() => { reloadQuietly(); }, [reloadQuietly]), enabled: !!storeId });

  const changeDate = (key: string) => {
    clear();
    setDate(key);
  };
  const tripCreated = () => {
    setAssigning(false);
    clear();
    reloadQuietly();
  };
  const openRiders = () => {
    setAssigning(false);
    router.push(`/manage/riders${storeId ? `?storeId=${storeId}` : ""}`);
  };

  return (
    <View style={styles.root}>
      <ManageScreen
        title="Delivery"
        headerRight={can(user?.role ?? "", "riders", "list") ? <RidersLink onPress={openRiders} /> : undefined}
        headerSubtitle={board ? `${readyCount(board)} ready to dispatch` : undefined}
        refreshing={refreshing}
        onRefresh={storeId ? refresh : undefined}
      >
        {storeId ? <DateBar value={date} onChange={changeDate} /> : null}
        <DeliveryContent
          storeId={storeId}
          scopeLoading={scopeLoading}
          loading={loading}
          error={error}
          board={board}
          trips={trips}
          selected={selected}
          onToggle={toggle}
          onMenu={setMenuOrder}
          onChanged={reloadQuietly}
          onRetry={refresh}
        />
      </ManageScreen>
      {selected.size > 0 && <SelectionBar count={selected.size} onClear={clear} onAssign={() => setAssigning(true)} />}
      <OrderActionSheet order={menuOrder} onClose={() => setMenuOrder(null)} onChanged={reloadQuietly} />
      {storeId && (
        <AssignRiderSheet
          visible={assigning}
          storeId={storeId}
          orderIds={[...selected]}
          onClose={() => setAssigning(false)}
          onCreated={tripCreated}
          onManageRiders={openRiders}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  riders: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: manage.inkRaised },
  ridersLabel: { fontFamily: fonts.bold, fontSize: 13, color: manage.inkText },
});
