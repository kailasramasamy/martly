import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { SectionCard } from "../ui/SectionCard";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { KpiGrid } from "./KpiGrid";
import { SENTIMENT, type ReviewSummary } from "./types";

const PERIODS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

function Bullets({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <SectionCard title={title}>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

function Summary({ data }: { data: ReviewSummary }) {
  const m = data.meta;
  return (
    <>
      {data.overallSentiment && SENTIMENT[data.overallSentiment] ? <StatusPill {...SENTIMENT[data.overallSentiment]} /> : null}
      <SectionCard><Text style={styles.summary}>{data.summary}</Text></SectionCard>
      <Bullets title="Positives" items={data.positives} color="#15803d" />
      <Bullets title="Negatives" items={data.negatives} color={colors.error} />
      <Bullets title="Patterns" items={data.patterns} color="#1d4ed8" />
      <Bullets title="Recommendations" items={data.recommendations} color={colors.primary} />
      <KpiGrid items={[
        { label: "Product reviews", value: String(m.reviewCount) },
        { label: "Store ratings", value: String(m.storeRatingCount) },
        { label: "Avg product rating", value: m.avgProductRating ? `${m.avgProductRating} / 5` : "-" },
        { label: "Avg store rating", value: m.avgStoreRating ? `${m.avgStoreRating} / 5` : "-" },
      ]} />
    </>
  );
}

export function ReviewSummaryPanel({ storeId }: { storeId: string }) {
  const { run, running } = useAction();
  const [period, setPeriod] = useState("90");
  const [data, setData] = useState<ReviewSummary | null>(null);

  const generate = async () => {
    setData(null);
    const res = await run(() => api.get<ReviewSummary>(`/api/v1/customer-insights/review-summary?storeId=${storeId}&days=${period}`));
    if (res) setData(res.data);
  };

  return (
    <View style={styles.root}>
      <SegmentedTabs options={PERIODS} value={period} onChange={setPeriod} />
      <Button label="Generate summary" icon="sparkles-outline" loading={running} onPress={generate} />
      {data && <Summary data={data} />}
      {!data && !running && <Text style={styles.hint}>Generate an AI summary of recent product reviews and store ratings.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  summary: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: colors.text },
  bullet: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  bulletText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  hint: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: "center", marginTop: 8 },
});
