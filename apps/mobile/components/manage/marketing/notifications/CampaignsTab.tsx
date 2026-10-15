import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { AudienceTypeLabels } from "@martly/shared/constants";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { StatusPill } from "../../ui/StatusPill";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { formatDate } from "../../ui/dates";
import { usePagedList } from "../../../../lib/manage/use-paged-list";
import { CAMPAIGN_STATUS, TONES } from "../common";
import type { Campaign } from "./types";

const TYPES = [
  { value: "", label: "All" },
  { value: "PROMOTIONAL", label: "Promotional" },
  { value: "GENERAL", label: "General" },
];

function dateCaption(c: Campaign): string {
  if (c.status === "SCHEDULED" && c.scheduledAt) return `Scheduled ${formatDate(c.scheduledAt, true)}`;
  return `${c.sentAt ? formatDate(c.sentAt, true) : formatDate(c.createdAt)} · ${c.recipientCount.toLocaleString("en-IN")} recipients`;
}

export function CampaignsTab({ tabs }: { tabs: ReactNode }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const list = usePagedList<Campaign>("/api/v1/notifications/admin/campaigns", { q, type });

  return (
    <ManageListScreen
      title="Push notifications"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search campaigns" }}
      filters={<>{tabs}<SegmentedTabs options={TYPES} value={type} onChange={setType} /></>}
      empty={{ icon: "megaphone-outline", title: "No campaigns yet", message: "Sent and scheduled campaigns show up here with their read rate." }}
      renderItem={(c) => {
        const status = CAMPAIGN_STATUS[c.status] ?? { label: c.status, ...TONES.slate };
        return (
          <ListRow
            title={c.title}
            subtitle={`${AudienceTypeLabels[c.audienceType as keyof typeof AudienceTypeLabels] ?? c.audienceType}`}
            caption={dateCaption(c)}
            railColor={status.color}
            value={c.status === "SENT" ? `${c.readRate}% read` : undefined}
            trailing={<StatusPill {...status} />}
            onPress={() => router.push(`/manage/notification-send/campaigns/${c.id}`)}
            chevron
          />
        );
      }}
    />
  );
}
