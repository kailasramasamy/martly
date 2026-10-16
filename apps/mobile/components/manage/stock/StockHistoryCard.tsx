import { useEffect } from "react";
import { StockMovementTypeLabels } from "@martly/shared/constants";
import { useResource } from "../../../lib/manage/use-resource";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { timeAgo } from "../ui/dates";
import type { StockMovementRow } from "./types";

const RECENT = 10;
const UP = { color: "#15803d", bg: "#dcfce7" };
const DOWN = { color: "#b91c1c", bg: "#fee2e2" };

interface StockHistoryCardProps {
  storeProductId: string;
  /** Bump to refetch after a stock change */
  refreshKey: number;
}

/** Latest stock movements for one listing: reason, signed quantity, before to after, who and when */
export function StockHistoryCard({ storeProductId, refreshKey }: StockHistoryCardProps) {
  const { data, error, reload } = useResource<StockMovementRow[]>(`/api/v1/stock/movements?storeProductId=${storeProductId}&pageSize=${RECENT}`);
  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);
  return (
    <SectionCard title="Stock history" flush>
      {error ? <ListRow title="Couldn't load history" subtitle={error} /> : null}
      {data && data.length === 0 && <ListRow icon="time-outline" title="No movements yet" subtitle="Receipts, counts and adjustments appear here." />}
      {data?.map((m) => (
        <ListRow
          key={m.id}
          icon="swap-vertical-outline"
          title={StockMovementTypeLabels[m.type]}
          subtitle={`${m.stockBefore} → ${m.stockAfter}${m.note ? ` · ${m.note}` : ""}`}
          caption={`${m.user?.name ?? "System"} · ${timeAgo(m.createdAt)}`}
          trailing={<StatusPill label={`${m.quantity > 0 ? "+" : ""}${m.quantity}`} {...(m.quantity > 0 ? UP : DOWN)} />}
        />
      ))}
    </SectionCard>
  );
}
