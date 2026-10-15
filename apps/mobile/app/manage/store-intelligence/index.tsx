import { useState, type ReactElement } from "react";
import { View, StyleSheet } from "react-native";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { StoreRequired } from "../../../components/manage/support/StoreRequired";
import { AnomalyPanel, ForecastPanel, ReorderPanel } from "../../../components/manage/insights/IntelligencePanels";

const TABS = [
  { value: "forecast" as const, label: "Demand forecast" },
  { value: "reorder" as const, label: "Reorder" },
  { value: "anomalies" as const, label: "Anomalies" },
];

function StoreIntelligence({ storeId, picker }: { storeId: string; picker: ReactElement | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("forecast");
  return (
    <ManageStackScreen title="Store intelligence">
      <View style={styles.picker}>{picker}</View>
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
      {tab === "forecast" && <ForecastPanel storeId={storeId} />}
      {tab === "reorder" && <ReorderPanel storeId={storeId} />}
      {tab === "anomalies" && <AnomalyPanel storeId={storeId} />}
    </ManageStackScreen>
  );
}

function StoreIntelligenceGate() {
  const { storeId, picker } = useStoreScope({ persist: true, placeholder: "Select a store" });
  if (!storeId) return <StoreRequired title="Store intelligence" message="Forecasts and alerts are calculated per store. Choose one above." picker={picker} />;
  return <StoreIntelligence storeId={storeId} picker={picker} />;
}

export default function StoreIntelligenceScreen() {
  return <AccessGate resource="store-intelligence"><StoreIntelligenceGate /></AccessGate>;
}

const styles = StyleSheet.create({
  picker: { padding: 12 },
});
