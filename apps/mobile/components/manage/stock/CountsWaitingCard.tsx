import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { refreshCountsWaiting, useWaitingCountStatus } from "../../../lib/manage/use-counts-waiting";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { timeAgo } from "../ui/dates";
import { COUNT_STATUS, type StockCountRow } from "./types";

const TITLES = { SUBMITTED: "Counts to review", RECOUNT: "Recount requested" };

function subtitle(c: StockCountRow, status: keyof typeof TITLES) {
  return status === "SUBMITTED" ? `${c.createdBy.name} · ${c._count.lines} items` : c.reviewNote || "Count the flagged items again";
}

/** Stock counts waiting on this member: approvers see ones to review, counters see ones sent back; hidden when none */
export function CountsWaitingCard({ storeId }: { storeId: string | null }) {
  const router = useRouter();
  const status = useWaitingCountStatus();
  const list = usePagedList<StockCountRow>("/api/v1/stock/counts", { status: status ?? undefined, storeId }, { pageSize: 3, enabled: !!status });
  const { reload } = list;
  useFocusEffect(useCallback(() => {
    if (!status) return;
    reload();
    refreshCountsWaiting();
  }, [status, reload]));
  if (!status || list.total === 0) return null;

  return (
    <SectionCard
      title={`${TITLES[status]} · ${list.total}`}
      action={{ label: "View all", onPress: () => router.push(`/manage/stock-counts?status=${status}`) }}
      flush
    >
      {list.items.map((c) => (
        <ListRow
          key={c.id}
          railColor={COUNT_STATUS[status].color}
          title={c.subcategory.name}
          subtitle={subtitle(c, status)}
          caption={timeAgo((status === "RECOUNT" ? c.reviewedAt : c.submittedAt) ?? c.createdAt)}
          trailing={<StatusPill {...COUNT_STATUS[status]} />}
          chevron
          onPress={() => router.push(`/manage/stock-counts/${c.id}`)}
        />
      ))}
    </SectionCard>
  );
}
