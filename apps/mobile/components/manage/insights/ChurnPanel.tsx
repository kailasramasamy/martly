import { useState } from "react";
import { View, Text, Linking, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { useResource } from "../../../lib/manage/use-resource";
import { KpiGrid } from "./KpiGrid";
import { AsyncBody } from "./AsyncBody";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { timeAgo } from "../ui/dates";
import { formatINR } from "../ui/tokens";
import { RISK, type ChurnCustomer, type ChurnData, type RiskLevel } from "./types";

const PAGE = 20;

type Filter = "all" | RiskLevel;

function CustomerRow({ c }: { c: ChurnCustomer }) {
  return (
    <View>
      <ListRow
        railColor={RISK[c.riskLevel].color}
        title={c.name}
        subtitle={`${c.totalOrders} orders · avg ${formatINR(c.avgOrderValue)} · last ${timeAgo(c.lastOrderDate)}`}
        caption={c.suggestedAction}
        value={formatINR(c.totalSpent)}
        trailing={<StatusPill {...RISK[c.riskLevel]} />}
      />
      {c.phone ? (
        <View style={styles.call}>
          <Button label={`Call ${c.phone}`} icon="call-outline" variant="ghost" compact onPress={() => Linking.openURL(`tel:${c.phone}`)} />
        </View>
      ) : null}
    </View>
  );
}

export function ChurnPanel({ storeId }: { storeId: string }) {
  const { data, loading, error, reload } = useResource<ChurnData>(`/api/v1/customer-insights/churn-risk?storeId=${storeId}`);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const s = data?.summary;
  const rows = (data?.customers ?? []).filter((c) => filter === "all" || c.riskLevel === filter);

  const tabs = s ? [
    { value: "all" as const, label: "All", count: s.totalCustomers },
    { value: "at_risk" as const, label: "At risk", count: s.atRisk },
    { value: "churning" as const, label: "Churning", count: s.churning },
    { value: "churned" as const, label: "Churned", count: s.churned },
  ] : [];

  return (
    <AsyncBody loading={loading} error={error} onRetry={reload}>
      {s && (
        <View style={styles.root}>
          <KpiGrid items={[
            { label: "Active", value: String(s.active) },
            { label: "At risk", value: String(s.atRisk) },
            { label: "Churning", value: String(s.churning) },
            { label: "Churned", value: String(s.churned) },
          ]} />
          <SegmentedTabs options={tabs} value={filter} onChange={(f) => { setFilter(f); setShown(PAGE); }} />
          <SectionCard title={`${rows.length} customers`} flush>
            {rows.length === 0 && <Text style={styles.none}>No customers in this group</Text>}
            {rows.slice(0, shown).map((c) => <CustomerRow key={c.id} c={c} />)}
            {rows.length > shown && <Button label="Show more" variant="ghost" onPress={() => setShown(shown + PAGE)} />}
          </SectionCard>
        </View>
      )}
    </AsyncBody>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  call: { backgroundColor: "#fff", paddingLeft: 10, alignItems: "flex-start" },
  none: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, padding: 14 },
});
