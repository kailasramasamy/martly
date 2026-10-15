import { useState } from "react";
import { useRouter } from "expo-router";
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

const TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "", label: "All" },
];

function ReturnRequestList() {
  const router = useRouter();
  const { storeId } = useManageScope();
  const [status, setStatus] = useState("PENDING");
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
          subtitle={`${reasonLabel(r.reason)} · #${r.order.id.slice(0, 8)}`}
          caption={`${r.store.name} · ${timeAgo(r.createdAt)}`}
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
