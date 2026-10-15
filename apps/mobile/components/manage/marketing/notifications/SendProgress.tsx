import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SectionCard } from "../../ui/SectionCard";
import { manage, tabular } from "../../ui/tokens";
import { api } from "../../../../lib/api";
import { colors, fonts } from "../../../../constants/theme";
import type { Campaign } from "./types";

const POLL_MS = 1500;
const POLL_LIMIT_MS = 300_000;

interface Props {
  campaignId: string;
  recipientCount: number;
  onFinished: (status: string) => void;
}

/** Polls the campaign until it is SENT or FAILED, showing delivered / recipients */
export function SendProgress({ campaignId, recipientCount, onFinished }: Props) {
  const [delivered, setDelivered] = useState(0);
  const [status, setStatus] = useState("SENDING");

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(async () => {
      const res = await api.get<Campaign>(`/api/v1/notifications/admin/campaigns/${campaignId}`).catch(() => null);
      if (res) {
        setDelivered(res.data._count?.notifications ?? 0);
        setStatus(res.data.status);
      }
      if (!res || res.data.status === "SENT" || res.data.status === "FAILED" || Date.now() - started > POLL_LIMIT_MS) {
        clearInterval(timer);
        onFinished(res?.data.status ?? "UNKNOWN");
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [campaignId, onFinished]);

  const pct = recipientCount > 0 ? Math.min(100, Math.round((delivered / recipientCount) * 100)) : 100;
  return (
    <SectionCard title={status === "SENDING" ? "Sending" : status === "SENT" ? "Sent" : "Failed"}>
      <Text style={[styles.count, tabular]}>{delivered.toLocaleString("en-IN")} / {recipientCount.toLocaleString("en-IN")} delivered</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: status === "FAILED" ? colors.error : colors.primary }]} /></View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginBottom: 10 },
  track: { height: 8, borderRadius: 4, backgroundColor: manage.line, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
