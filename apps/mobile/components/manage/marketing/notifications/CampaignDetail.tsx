import { View, Image, Text, StyleSheet } from "react-native";
import { AudienceTypeLabels } from "@martly/shared/constants";
import { ManageStackScreen } from "../../ManageStackScreen";
import { SectionCard } from "../../ui/SectionCard";
import { KpiTile } from "../../ui/KpiTile";
import { KeyValue } from "../../ui/KeyValue";
import { StatusPill } from "../../ui/StatusPill";
import { formatDate } from "../../ui/dates";
import { formatINR, manage } from "../../ui/tokens";
import { useResource } from "../../../../lib/manage/use-resource";
import { colors, fonts, radius } from "../../../../constants/theme";
import { CAMPAIGN_STATUS, TONES } from "../common";
import type { Campaign } from "./types";

const CONFIG_LABEL: Record<string, string> = { storeId: "Store", days: "Days", minAmount: "Min spend" };

function configValue(key: string, value: unknown): string {
  return key === "minAmount" ? formatINR(Number(value)) : String(value);
}

export function CampaignDetail({ id }: { id: string }) {
  const { data: c, loading, error, reload } = useResource<Campaign>(`/api/v1/notifications/admin/campaigns/${id}`);
  const status = c ? CAMPAIGN_STATUS[c.status] ?? { label: c.status, ...TONES.slate } : null;
  const config = Object.entries(c?.audienceConfig ?? {}).filter(([, v]) => v != null && v !== "");

  return (
    <ManageStackScreen title={c?.title ?? "Campaign"} loading={loading} error={error} onRetry={reload} onRefresh={reload}>
      {c && status ? (
        <>
          <View style={styles.row}>
            <KpiTile label="Recipients" value={c.recipientCount.toLocaleString("en-IN")} />
            <KpiTile label="Read" value={c.readCount.toLocaleString("en-IN")} />
            <KpiTile label="Read rate" value={`${c.readRate}%`} />
          </View>
          <SectionCard title="Content">
            <Text style={styles.title}>{c.title}</Text>
            <Text style={styles.body}>{c.body}</Text>
            {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
          </SectionCard>
          <SectionCard title="Details">
            <View style={styles.pill}><StatusPill {...status} /></View>
            <KeyValue label="Type" value={c.type === "PROMOTIONAL" ? "Promotional" : "General"} />
            <KeyValue label="Audience" value={AudienceTypeLabels[c.audienceType as keyof typeof AudienceTypeLabels] ?? c.audienceType} />
            {config.map(([k, v]) => <KeyValue key={k} label={CONFIG_LABEL[k] ?? k} value={configValue(k, v)} />)}
            <KeyValue label={c.status === "SCHEDULED" ? "Scheduled for" : "Sent"} value={formatDate(c.scheduledAt && c.status === "SCHEDULED" ? c.scheduledAt : c.sentAt, true)} />
            <KeyValue label="Sent by" value={c.sentByUser?.name} />
          </SectionCard>
        </>
      ) : null}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  pill: { marginBottom: 6 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, marginTop: 6, lineHeight: 21 },
  image: { width: "100%", aspectRatio: 2, borderRadius: radius.md, marginTop: 12, backgroundColor: manage.canvas },
});
