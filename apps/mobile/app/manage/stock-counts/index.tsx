import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useManageScope } from "../../../lib/manage-scope-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { timeAgo } from "../../../components/manage/ui/dates";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { COUNT_STATUS, type CountStatus, type StockCountRow } from "../../../components/manage/stock/types";
import { useStockAccess } from "../../../components/manage/stock/use-stock-access";

// "" lists every count, newest first, each with its status pill
const TABS: { value: CountStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "In progress" },
  { value: "SUBMITTED", label: "To review" },
  { value: "RECOUNT", label: "Recount" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function StockCountList() {
  const router = useRouter();
  const { canCount } = useStockAccess();
  const { storeId } = useManageScope();
  // Links like "View all" from Today can open a tab directly
  const params = useLocalSearchParams<{ status?: CountStatus }>();
  const [status, setStatus] = useState<CountStatus | "">(params.status ?? "");
  const list = usePagedList<StockCountRow>("/api/v1/stock/counts", { status, storeId });

  return (
    <ManageListScreen
      title="Stock counts"
      list={list}
      filters={<SegmentedTabs options={TABS} value={status} onChange={setStatus} />}
      headerRight={canCount ? () => <HeaderAction accessibilityLabel="New stock count" onPress={() => router.push("/manage/stock-counts/new")} /> : undefined}
      empty={{ icon: "clipboard-outline", title: "No counts here", message: canCount ? "Tap + to count an aisle." : "Counts will show up here." }}
      renderItem={(c) => (
        <ListRow
          railColor={COUNT_STATUS[c.status].color}
          title={c.subcategory.name}
          subtitle={`${c.store.name} · ${c.createdBy.name}`}
          caption={`${c._count.lines} items · ${timeAgo(c.submittedAt ?? c.createdAt)}`}
          trailing={<StatusPill {...COUNT_STATUS[c.status]} />}
          chevron
          onPress={() => router.push(`/manage/stock-counts/${c.id}`)}
        />
      )}
    />
  );
}

export default function StockCountsScreen() {
  return <AccessGate resource="stock-counts"><StockCountList /></AccessGate>;
}
