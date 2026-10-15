import { useState } from "react";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { formatDate } from "../../../components/manage/ui/dates";
import { formatINR } from "../../../components/manage/ui/tokens";
import { TONES, type Tone } from "../../../components/manage/marketing/common";
import { DURATION_LABEL } from "../../../components/manage/marketing/MembershipPlanForm";
import type { MembershipSubscriber } from "../../../components/manage/marketing/loyalty-types";
import { usePagedList } from "../../../lib/manage/use-paged-list";

const STATUS: Record<MembershipSubscriber["status"], Tone> = {
  ACTIVE: { label: "Active", ...TONES.green },
  EXPIRED: { label: "Expired", ...TONES.slate },
  CANCELLED: { label: "Cancelled", ...TONES.red },
};

export default function MembershipSubscribersScreen() {
  const [search, setSearch] = useState("");
  const list = usePagedList<MembershipSubscriber>("/api/v1/memberships/subscribers", { search });

  return (
    <ManageListScreen
      title="Membership subscribers"
      list={list}
      search={{ value: search, onChange: setSearch, placeholder: "Search by name or email" }}
      empty={{ icon: "people-outline", title: "No subscribers yet", message: "Customers who buy a plan appear here." }}
      renderItem={(s) => {
        const tone = STATUS[s.status];
        return (
          <ListRow
            title={s.user.name || s.user.email || "Customer"}
            subtitle={`${s.plan.name} · ${DURATION_LABEL[s.plan.duration] ?? s.plan.duration}`}
            caption={`${formatDate(s.startDate)} → ${formatDate(s.endDate)}`}
            railColor={tone.color}
            value={formatINR(s.pricePaid)}
            trailing={<StatusPill {...tone} />}
          />
        );
      }}
    />
  );
}
