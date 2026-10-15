import { useState } from "react";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { formatDate } from "../../../components/manage/ui/dates";
import { formatINR } from "../../../components/manage/ui/tokens";
import { TONES, type Tone } from "../../../components/manage/marketing/common";
import type { ReferralItem } from "../../../components/manage/marketing/loyalty-types";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useManageScope } from "../../../lib/manage-scope-context";

const STATUS: Record<ReferralItem["status"], Tone> = {
  PENDING: { label: "Pending", ...TONES.amber },
  COMPLETED: { label: "Completed", ...TONES.green },
  EXPIRED: { label: "Expired", ...TONES.red },
};

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "EXPIRED", label: "Expired" },
];

const personName = (p: { name: string | null; email: string | null }) => p.name || p.email || "Customer";

export default function ReferralListScreen() {
  const { organizationId } = useManageScope();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const list = usePagedList<ReferralItem>("/api/v1/referrals/list", { search, status, organizationId });

  return (
    <ManageListScreen
      title="Referrals"
      list={list}
      search={{ value: search, onChange: setSearch, placeholder: "Search referrer or referee" }}
      filters={<SegmentedTabs options={TABS} value={status} onChange={setStatus} />}
      empty={{ icon: "gift-outline", title: "No referrals yet", message: "Referrals appear once customers share their codes." }}
      renderItem={(r) => {
        const tone = STATUS[r.status];
        return (
          <ListRow
            title={`${personName(r.referrer)} → ${personName(r.referee)}`}
            subtitle={r.referrer.referralCode ? `Code ${r.referrer.referralCode}` : undefined}
            caption={`${r.completedAt ? `Completed ${formatDate(r.completedAt)}` : `Invited ${formatDate(r.createdAt)}`} · ${formatINR(r.referrerReward)} + ${formatINR(r.refereeReward)}`}
            railColor={tone.color}
            trailing={<StatusPill {...tone} />}
          />
        );
      }}
    />
  );
}
