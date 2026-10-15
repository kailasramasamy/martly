import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useResource } from "../../../lib/manage/use-resource";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { timeAgo } from "../ui/dates";
import { AsyncBody } from "./AsyncBody";
import { KpiGrid } from "./KpiGrid";
import { useAnomalies } from "./useAnomalies";
import { ShowMoreList } from "./ShowMoreList";
import {
  ANOMALY_TYPE,
  SEVERITY_COLOR,
  URGENCY,
  daysLeftTone,
  type AnomalyType,
  type DemandRow,
  type ReorderRow,
} from "./intelTypes";

const BASE = "/api/v1/store-intelligence";

function periods(values: string[]) {
  return values.map((v) => ({ value: v, label: `${v}d` }));
}

export function ForecastPanel({ storeId }: { storeId: string }) {
  const [days, setDays] = useState("30");
  const { data, loading, error, reload } = useResource<DemandRow[]>(`${BASE}/demand-forecast?storeId=${storeId}&days=${days}`);
  const rows = data ?? [];
  const low = rows.filter((r) => r.daysOfStockLeft >= 0 && r.daysOfStockLeft <= 3).length;

  return (
    <View style={styles.root}>
      <SegmentedTabs options={periods(["7", "14", "30", "90"])} value={days} onChange={setDays} />
      <AsyncBody loading={loading} error={error} onRetry={reload}>
        <KpiGrid items={[
          { label: "Products with demand", value: String(rows.length) },
          { label: "Under 3 days of stock", value: String(low) },
        ]} />
        <ShowMoreList
          title="Demand forecast"
          items={rows}
          emptyTitle="No order history in this period"
          renderItem={(r) => (
            <ListRow
              key={r.storeProductId}
              imageUrl={r.imageUrl}
              title={r.productName}
              subtitle={r.variantName}
              caption={`${r.currentStock} in stock · ${r.avgDailyDemand}/day · ${r.totalQuantitySold} sold · last ${timeAgo(r.lastOrderDate)}`}
              trailing={<StatusPill {...daysLeftTone(r.daysOfStockLeft)} />}
            />
          )}
        />
      </AsyncBody>
    </View>
  );
}

export function ReorderPanel({ storeId }: { storeId: string }) {
  const [threshold, setThreshold] = useState("7");
  const { data, loading, error, reload } = useResource<ReorderRow[]>(`${BASE}/reorder-suggestions?storeId=${storeId}&threshold=${threshold}`);
  const rows = data ?? [];
  const count = (u: ReorderRow["urgency"]) => String(rows.filter((r) => r.urgency === u).length);

  return (
    <View style={styles.root}>
      <SegmentedTabs options={periods(["3", "5", "7", "14"])} value={threshold} onChange={setThreshold} />
      <AsyncBody loading={loading} error={error} onRetry={reload}>
        <KpiGrid items={[
          { label: "Critical", value: count("critical") },
          { label: "Warning", value: count("warning") },
          { label: "Info", value: count("info") },
        ]} />
        <ShowMoreList
          title="Reorder suggestions"
          items={rows}
          emptyTitle="Nothing to reorder"
          renderItem={(r) => (
            <ListRow
              key={r.storeProductId}
              railColor={URGENCY[r.urgency].color}
              imageUrl={r.imageUrl}
              title={r.productName}
              subtitle={r.variantName}
              caption={`${r.currentStock} in stock · ${daysLeftTone(r.daysOfStockLeft).label} · ${r.avgDailyDemand}/day`}
              value={`Order ${r.suggestedReorderQty}`}
              trailing={<StatusPill {...URGENCY[r.urgency]} />}
            />
          )}
        />
      </AsyncBody>
    </View>
  );
}

export function AnomalyPanel({ storeId }: { storeId: string }) {
  const [days, setDays] = useState("30");
  const [type, setType] = useState<"all" | AnomalyType>("all");
  const { rows, total, loading, error, reload } = useAnomalies(storeId, days, type);
  const typeTabs = [
    { value: "all" as const, label: "All" },
    ...(Object.keys(ANOMALY_TYPE) as AnomalyType[]).map((k) => ({ value: k, label: ANOMALY_TYPE[k].label })),
  ];

  return (
    <View style={styles.root}>
      <SegmentedTabs options={periods(["7", "14", "30"])} value={days} onChange={setDays} />
      <SegmentedTabs options={typeTabs} value={type} onChange={setType} />
      <AsyncBody loading={loading} error={error} onRetry={reload}>
        <ShowMoreList
          title={total > rows.length ? `Top ${rows.length} of ${total}` : `${total} anomalies`}
          items={rows}
          emptyTitle="No anomalies detected"
          renderItem={(a) => (
            <ListRow
              key={`${a.storeProductId}-${a.type}`}
              railColor={SEVERITY_COLOR[a.severity]}
              title={a.productName}
              subtitle={a.variantName}
              caption={a.message}
              trailing={<StatusPill {...ANOMALY_TYPE[a.type]} />}
            />
          )}
        />
      </AsyncBody>
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: 14 } });
