import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../../../../constants/theme";
import { ManageScreen } from "../../ManageScreen";
import { manage } from "../../ui/tokens";
import { DateBar } from "../DateBar";
import { useDispatchAccess } from "../use-dispatch-access";
import { PlanContent } from "./PlanContent";
import { usePlanDesk } from "./use-plan-desk";

function RidersLink({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.riders} onPress={onPress} accessibilityRole="button" accessibilityLabel="Riders" activeOpacity={0.8}>
      <Ionicons name="bicycle-outline" size={16} color={manage.inkText} />
      <Text style={styles.ridersLabel}>Riders</Text>
    </TouchableOpacity>
  );
}

/** The Delivery tab for dispatchers: pick a day and a wave, plan it, assign riders, watch trips go out */
export function DispatcherDelivery() {
  const desk = usePlanDesk();
  const { canManageRiders } = useDispatchAccess();
  const { storeId, data } = desk;
  return (
    <View style={styles.root}>
      <ManageScreen
        title="Delivery"
        headerRight={canManageRiders ? <RidersLink onPress={desk.openRiders} /> : undefined}
        refreshing={data.refreshing}
        onRefresh={storeId ? data.refresh : undefined}
      >
        {storeId ? <DateBar value={desk.date} onChange={desk.changeDate} /> : null}
        <PlanContent desk={desk} />
      </ManageScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  riders: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: manage.inkRaised },
  ridersLabel: { fontFamily: fonts.bold, fontSize: 13, color: manage.inkText },
});
