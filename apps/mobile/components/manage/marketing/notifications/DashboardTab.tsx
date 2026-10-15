import { useState, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../../ManageStackScreen";
import { SectionCard } from "../../ui/SectionCard";
import { KpiTile } from "../../ui/KpiTile";
import { Sparkline } from "../../ui/Sparkline";
import { ListRow } from "../../ui/ListRow";
import { StatusPill } from "../../ui/StatusPill";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { EmptyState } from "../../ui/EmptyState";
import { KeyValue } from "../../ui/KeyValue";
import { formatDate } from "../../ui/dates";
import { useResource } from "../../../../lib/manage/use-resource";
import { CAMPAIGN_STATUS, TONES } from "../common";
import type { NotificationStats } from "./types";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export function DashboardTab({ tabs }: { tabs: ReactNode }) {
  const router = useRouter();
  const [days, setDays] = useState("30");
  const { data, loading, error, reload } = useResource<NotificationStats>(`/api/v1/notifications/admin/stats?days=${days}`);
  const open = (id: string) => router.push(`/manage/notification-send/campaigns/${id}`);

  return (
    <ManageStackScreen title="Push notifications" loading={loading && !data} error={error} onRetry={reload} onRefresh={reload}>
      {tabs}
      <SegmentedTabs options={RANGES} value={days} onChange={setDays} />
      {data ? (
        <>
          <View style={styles.row}>
            <KpiTile label="Campaigns sent" value={String(data.kpis.campaignsSent)} />
            <KpiTile label="Delivered" value={data.kpis.notificationsDelivered.toLocaleString("en-IN")} trend={data.dailyStats.map((d) => d.notifications)} />
          </View>
          <View style={styles.row}>
            <KpiTile label="Read rate" value={`${data.kpis.readRate}%`} />
            <KpiTile label="Avg recipients" value={data.kpis.avgRecipients.toLocaleString("en-IN")} />
          </View>
          {data.dailyStats.length > 1 ? <SectionCard title="Notifications per day"><Sparkline values={data.dailyStats.map((d) => d.notifications)} height={56} /></SectionCard> : null}
          <SectionCard title="By type">
            {data.byType.length === 0 ? <EmptyState icon="stats-chart-outline" title="Nothing sent in this period" /> : data.byType.map((t) => (
              <KeyValue key={t.type} label={t.type === "PROMOTIONAL" ? "Promotional" : t.type === "GENERAL" ? "General" : t.type} value={`${t.count} campaigns · ${t.notifications.toLocaleString("en-IN")} sent`} />
            ))}
          </SectionCard>
          <SectionCard title="Top campaigns" flush>
            {data.topCampaigns.map((c) => <ListRow key={c.id} title={c.title} subtitle={`${c.recipientCount.toLocaleString("en-IN")} recipients`} value={`${c.readRate}% read`} onPress={() => open(c.id)} chevron />)}
          </SectionCard>
          <SectionCard title="Recent campaigns" flush>
            {data.recentCampaigns.map((c) => {
              const status = CAMPAIGN_STATUS[c.status] ?? { label: c.status, ...TONES.slate };
              return <ListRow key={c.id} title={c.title} caption={formatDate(c.sentAt ?? c.createdAt, true)} railColor={status.color} trailing={<StatusPill {...status} />} onPress={() => open(c.id)} chevron />;
            })}
          </SectionCard>
        </>
      ) : null}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
});
