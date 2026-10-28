import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PriceReviewSummary } from "@martly/shared/types";
import type { PriceReviewOutcome } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../constants/theme";
import { KpiTile } from "../ui/KpiTile";
import { SearchField } from "../ui/SearchField";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { manage, tabular } from "../ui/tokens";
import { ProgressHero } from "./ProgressHero";
import { DepartmentStrip } from "./DepartmentStrip";
import { StockCheckBanner } from "./StockCheckBanner";

export type GroupBy = "brand" | "subcategory";
/** Which listings a KPI tile opens; pending opens the queue */
export type QueueFilter = { status: "pending" | "notCarried" } | { status: "reviewed"; outcome: PriceReviewOutcome };

interface Props {
  storeId: string;
  picker: ReactNode;
  summary: PriceReviewSummary;
  departmentId: string | null;
  onDepartment: (id: string | null) => void;
  by: GroupBy;
  onBy: (by: GroupBy) => void;
  q: string;
  onSearch: (q: string) => void;
  onOpenQueue: (filter: QueueFilter) => void;
}

const GROUP_TABS = [{ value: "brand" as const, label: "By brand" }, { value: "subcategory" as const, label: "By aisle" }];
const n = (v: number) => v.toLocaleString("en-IN");

/** Progress, what's settled how, the best-seller shortcut and the department filter, above the brand/aisle list */
export function OverviewHeader(props: Props) {
  const { summary, onOpenQueue } = props;
  return (
    <View style={styles.wrap}>
      {props.picker && <View style={styles.pad}>{props.picker}</View>}
      <StockCheckBanner storeId={props.storeId} />
      <View style={styles.pad}><ProgressHero summary={summary} /></View>
      <View style={[styles.pad, styles.tiles]}>
        <KpiTile label="To check" value={n(summary.pending)} onPress={() => onOpenQueue({ status: "pending" })} />
        <KpiTile label="Kept" value={n(summary.kept)} onPress={() => onOpenQueue({ status: "reviewed", outcome: "KEPT" })} />
        <KpiTile label="Changed" value={n(summary.changed)} onPress={() => onOpenQueue({ status: "reviewed", outcome: "CHANGED" })} />
        <KpiTile label="Not sold" value={n(summary.notCarried)} onPress={() => onOpenQueue({ status: "notCarried" })} />
      </View>
      {summary.topSellersPending > 0 && (
        <TouchableOpacity style={[styles.best]} onPress={() => onOpenQueue({ status: "pending" })} activeOpacity={0.8} accessibilityRole="button">
          <View style={styles.bestIcon}><Ionicons name="flame" size={18} color={manage.attentionText} /></View>
          <View style={styles.bestBody}>
            <Text style={styles.bestTitle}>Start with your best sellers</Text>
            <Text style={[styles.bestMeta, tabular]}>{n(summary.topSellersPending)} sold this month and still need a look</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={manage.attentionText} />
        </TouchableOpacity>
      )}
      <Text style={[styles.section, styles.pad]}>BY DEPARTMENT</Text>
      <DepartmentStrip departments={summary.departments} value={props.departmentId} onChange={props.onDepartment} />
      <View style={[styles.pad, styles.controls]}>
        <SegmentedTabs options={GROUP_TABS} value={props.by} onChange={props.onBy} />
        <SearchField value={props.q} onChange={props.onSearch} placeholder={props.by === "brand" ? "Search brands" : "Search aisles"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingTop: 12, paddingBottom: 4 },
  pad: { paddingHorizontal: 16 },
  tiles: { flexDirection: "row", gap: 8 },
  best: {
    flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, padding: 14,
    borderRadius: radius.lg, backgroundColor: manage.attentionBg,
  },
  bestIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fde68a", alignItems: "center", justifyContent: "center" },
  bestBody: { flex: 1, gap: 2 },
  bestTitle: { fontFamily: fonts.bold, fontSize: 15, color: manage.attentionText },
  bestMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.attentionText },
  section: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary, marginTop: 4 },
  controls: { gap: 10, marginTop: 4 },
});
