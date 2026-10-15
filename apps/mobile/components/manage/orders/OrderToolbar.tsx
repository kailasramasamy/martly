import { View, StyleSheet } from "react-native";
import { SearchField } from "../ui/SearchField";
import { SegmentedTabs, type SegmentOption } from "../ui/SegmentedTabs";
import { manage } from "../ui/tokens";
import type { StatusCounts } from "./use-status-counts";

export const ORDER_TABS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "New" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All" },
] as const;

export const COUNTED_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;

interface OrderToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  status: string;
  onStatus: (status: string) => void;
  counts: StatusCounts;
}

export function OrderToolbar({ query, onQuery, status, onStatus, counts }: OrderToolbarProps) {
  const active = COUNTED_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const options: SegmentOption<string>[] = ORDER_TABS.map((t) => ({ ...t, count: t.value === "ACTIVE" ? active : counts[t.value] }));
  return (
    <View style={styles.toolbar}>
      <SearchField value={query} onChange={onQuery} placeholder="Search order ID or customer" />
      <SegmentedTabs options={options} value={status} onChange={onStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { padding: 12, gap: 10, backgroundColor: manage.canvas, borderBottomWidth: 1, borderBottomColor: manage.line },
});
