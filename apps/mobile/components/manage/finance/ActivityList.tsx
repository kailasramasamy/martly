import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LedgerEntryTypeLabels, type LedgerEntryGroup } from "@martly/shared/constants";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { ListRow } from "../ui/ListRow";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { StatusPill } from "../ui/StatusPill";
import { DateField } from "../ui/DateField";
import { formatDate } from "../ui/dates";
import { amountColor, entryIcon, entryPill, signedINR } from "./format";
import { useFinanceScope } from "./use-finance-scope";
import type { LedgerEntry } from "../../../lib/ledger-types";

const TABS: { value: LedgerEntryGroup | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "SALES", label: "Sales" },
  { value: "REFUNDS", label: "Refunds" },
  { value: "FEES", label: "Fees" },
  { value: "PAYOUTS", label: "Payouts" },
];

export function ActivityList() {
  const router = useRouter();
  const { query, picker } = useFinanceScope();
  const [group, setGroup] = useState<LedgerEntryGroup | "">("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const list = usePagedList<LedgerEntry>("/api/v1/ledger", { ...query, group, q: search, from, to }, { pageSize: 30 });

  return (
    <ManageListScreen
      title="Activity"
      list={list}
      search={{ value: search, onChange: setSearch, placeholder: "Search order, store or note" }}
      filters={
        <>
          {picker}
          <SegmentedTabs options={TABS} value={group} onChange={setGroup} />
          <View style={styles.dates}>
            <View style={styles.date}><DateField value={from} onChange={setFrom} placeholder="From date" /></View>
            <View style={styles.date}><DateField value={to} onChange={setTo} placeholder="To date" minDate={from ?? undefined} /></View>
          </View>
        </>
      }
      empty={{ icon: "list-outline", title: "No activity", message: "Sales, refunds and payouts will show up here." }}
      renderItem={(e) => (
        <ListRow
          icon={entryIcon(e.type)}
          title={e.memo ?? LedgerEntryTypeLabels[e.type]}
          subtitle={[LedgerEntryTypeLabels[e.type], e.storeName].filter(Boolean).join(" · ")}
          caption={formatDate(e.createdAt)}
          value={signedINR(e.amount, { decimals: true })}
          valueColor={amountColor(e.amount)}
          trailing={<StatusPill {...entryPill(e)} />}
          chevron
          onPress={() => router.push(`/manage/finance/activity/${e.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  dates: { flexDirection: "row", gap: 8 },
  date: { flex: 1 },
});
