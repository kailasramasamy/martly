import { useState } from "react";
import { useRouter } from "expo-router";
import { useManageScope } from "../../../lib/manage-scope-context";
import { toQuery } from "../../../lib/manage/query";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { timeAgo } from "../../../components/manage/ui/dates";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { TICKET_PRIORITY, TICKET_STATUS, type TicketRow, type TicketStats } from "../../../components/manage/support/types";
import { useResource } from "../../../lib/manage/use-resource";

function useTicketStats(storeId: string | null): TicketStats | null {
  return useResource<TicketStats>(`/api/v1/support/tickets/stats${toQuery({ storeId })}`).data;
}

function TicketList() {
  const router = useRouter();
  const { storeId } = useManageScope();
  const [status, setStatus] = useState("OPEN");
  const [search, setSearch] = useState("");
  const stats = useTicketStats(storeId);
  const list = usePagedList<TicketRow>("/api/v1/support/tickets", { status, storeId, search });
  const tabs = [
    { value: "OPEN", label: "Open", count: stats?.open },
    { value: "RESOLVED", label: "Resolved" },
    { value: "CLOSED", label: "Closed" },
    { value: "", label: "All" },
  ];

  return (
    <ManageListScreen
      title="Support tickets"
      list={list}
      search={{ value: search, onChange: setSearch, placeholder: "Search subject or customer" }}
      filters={<SegmentedTabs options={tabs} value={status} onChange={setStatus} />}
      empty={{ icon: "headset-outline", title: "No tickets", message: "Customer support requests will show up here." }}
      renderItem={(t) => (
        <ListRow
          railColor={TICKET_PRIORITY[t.priority].color}
          title={t.subject}
          subtitle={`${t.user.name}${t.store ? ` · ${t.store.name}` : ""}`}
          caption={timeAgo(t.createdAt)}
          trailing={<StatusPill {...TICKET_STATUS[t.status]} />}
          chevron
          onPress={() => router.push(`/manage/support-tickets/${t.id}`)}
        />
      )}
    />
  );
}

export default function SupportTicketsScreen() {
  return <AccessGate resource="support-tickets"><TicketList /></AccessGate>;
}
