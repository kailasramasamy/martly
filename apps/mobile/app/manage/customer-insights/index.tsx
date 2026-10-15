import { useState, type ReactElement } from "react";
import { View, StyleSheet } from "react-native";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { StoreRequired } from "../../../components/manage/support/StoreRequired";
import { AskPanel } from "../../../components/manage/insights/AskPanel";
import { ChurnPanel } from "../../../components/manage/insights/ChurnPanel";
import { ReviewSummaryPanel } from "../../../components/manage/insights/ReviewSummaryPanel";

const TABS = [
  { value: "ask" as const, label: "Ask your store" },
  { value: "churn" as const, label: "Churn risk" },
  { value: "reviews" as const, label: "Review insights" },
];

function CustomerInsights({ storeId, picker }: { storeId: string; picker: ReactElement | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("ask");
  return (
    <ManageStackScreen title="Customer insights">
      <View style={styles.picker}>{picker}</View>
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
      {tab === "ask" && <AskPanel storeId={storeId} />}
      {tab === "churn" && <ChurnPanel storeId={storeId} />}
      {tab === "reviews" && <ReviewSummaryPanel storeId={storeId} />}
    </ManageStackScreen>
  );
}

function CustomerInsightsGate() {
  const { storeId, picker } = useStoreScope({ persist: true, placeholder: "Select a store" });
  if (!storeId) return <StoreRequired title="Customer insights" message="Customer insights are calculated per store. Choose one above." picker={picker} />;
  return <CustomerInsights storeId={storeId} picker={picker} />;
}

export default function CustomerInsightsScreen() {
  return <AccessGate resource="customer-insights"><CustomerInsightsGate /></AccessGate>;
}

const styles = StyleSheet.create({
  picker: { padding: 12 },
});
