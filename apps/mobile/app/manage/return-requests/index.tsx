import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useManageScope } from "../../../lib/manage-scope-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { timeAgo } from "../../../components/manage/ui/dates";
import { formatINR } from "../../../components/manage/ui/tokens";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { RETURN_STATUS, reasonLabel, type ReturnRequestRow } from "../../../components/manage/returns/types";
import { orderRef } from "../../../components/manage/rider/format";

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "APPROVED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
];

/** How a returned item came back, once it has */
function handover(r: ReturnRequestRow): string | null {
  if (r.collectedOnOrderId) return `Collected with ${orderRef(r.collectedOnOrderId)}`;
  return r.receivedAt ? "Dropped at store" : null;
}

function ReturnRequestList() {
  const router = useRouter();
  const { storeId } = useManageScope();
  const params = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState(params.status ?? "");
  const [search, setSearch] = useState("");
  const list = usePagedList<ReturnRequestRow>("/api/v1/return-requests", { status, storeId, search });

  return (
    <ManageListScreen
      title="Return requests"
      list={list}
      search={{ value: search, onChange: setSearch, placeholder: "Search customer or order" }}
      filters={<SegmentedTabs options={TABS} value={status} onChange={setStatus} />}
      empty={{ icon: "return-down-back-outline", title: "No return requests", message: "Requests from customers will show up here." }}
      renderItem={(r) => (
        <ListRow
          railColor={RETURN_STATUS[r.status].color}
          title={r.user.name}
          subtitle={`${reasonLabel(r.reason)} · ${orderRef(r.order.id)}`}
          caption={[r.store.name, handover(r), timeAgo(r.updatedAt)].filter(Boolean).join(" · ")}
          value={formatINR(r.requestedAmount)}
          trailing={<StatusPill {...RETURN_STATUS[r.status]} />}
          chevron
          onPress={() => router.push(`/manage/return-requests/${r.id}`)}
        />
      )}
    />
  );
}

export default function ReturnRequestsScreen() {
  return <AccessGate resource="return-requests"><ReturnRequestList /></AccessGate>;
}
