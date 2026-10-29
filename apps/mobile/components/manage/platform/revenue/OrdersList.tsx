import { useState } from "react";
import { Linking } from "react-native";
import { AdProductKindLabels, type AdProductKind } from "@martly/shared/constants";
import { getApiUrl } from "../../../../lib/api";
import { usePagedList } from "../../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { formatINR } from "../../ui/tokens";
import { TONES } from "../../marketing/common";
import { RevenueSummary } from "./RevenueSummary";
import { formatDate, type AdOrderRow, type OrdersMeta } from "./types";

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: "Paid", ...TONES.green },
  PENDING: { label: "Pending", ...TONES.amber },
  FAILED: { label: "Failed", ...TONES.red },
  CANCELLED: { label: "Cancelled", ...TONES.slate },
  REFUNDED: { label: "Refunded", ...TONES.violet },
};

const STATUS_OPTIONS = [{ value: "", label: "All" }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))];
const KIND_OPTIONS = [{ value: "", label: "All products" }, ...Object.entries(AdProductKindLabels).map(([value, label]) => ({ value, label }))];

const buyerOf = (o: AdOrderRow) => o.organization?.name ?? o.brand?.name ?? "—";

export function OrdersList() {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const list = usePagedList<AdOrderRow, OrdersMeta>("/api/v1/marketing-admin/orders", { status, kind }, { pageSize: 25 });
  return (
    <ManageListScreen
      title="Marketing revenue"
      list={list}
      collapseToolbar
      filters={
        <>
          <RevenueSummary thisMonth={list.meta?.revenue.thisMonth} allTime={list.meta?.revenue.allTime} />
          <SegmentedTabs options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <SegmentedTabs options={KIND_OPTIONS} value={kind} onChange={(v) => setKind(v as AdProductKind | "")} />
        </>
      }
      empty={{ icon: "receipt-outline", title: "No orders", message: status || kind ? "Try different filters." : "Ad purchases show up here." }}
      renderItem={(o) => (
        <ListRow
          title={`${o.product.name} × ${o.quantity}`}
          subtitle={buyerOf(o)}
          caption={`${o.number ?? "No invoice"} · ${formatDate(o.paidAt ?? o.createdAt)}`}
          value={formatINR(o.total, { decimals: true })}
          status={STATUS[o.status] ?? { label: o.status, ...TONES.slate }}
          onPress={o.invoiceUrl ? () => Linking.openURL(`${getApiUrl()}${o.invoiceUrl}`) : undefined}
        />
      )}
    />
  );
}
