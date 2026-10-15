import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { useManageScope } from "../../../lib/manage-scope-context";
import { toQuery } from "../../../lib/manage/query";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { Sparkline } from "../../../components/manage/ui/Sparkline";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { AsyncBody } from "../../../components/manage/insights/AsyncBody";
import { BarRow } from "../../../components/manage/insights/Bars";
import { KpiGrid } from "../../../components/manage/insights/KpiGrid";
import { ProductRatingList } from "../../../components/manage/insights/ProductRatingList";
import { StoreRatingSummaryTiles } from "../../../components/manage/reviews/StoreRatingSummaryTiles";
import type { ReviewAnalyticsData } from "../../../components/manage/reviews/types";

const PERIODS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

function ReviewAnalytics() {
  const { storeId } = useManageScope();
  const [days, setDays] = useState("30");
  const { data, loading, error, reload } = useResource<ReviewAnalyticsData>(`/api/v1/review-analytics${toQuery({ days, storeId })}`);
  const maxStar = data ? Math.max(...Object.values(data.distribution), 0) : 0;

  return (
    <ManageStackScreen title="Review analytics">
      <SegmentedTabs options={PERIODS} value={days} onChange={setDays} />
      <AsyncBody loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <KpiGrid items={[
              { label: "Reviews", value: String(data.kpis.totalReviews) },
              { label: "Avg rating", value: `${data.kpis.avgRating.toFixed(1)} / 5` },
              { label: "Pending moderation", value: String(data.kpis.pendingModeration) },
              { label: "Reply rate", value: `${data.kpis.responseRate}%` },
            ]} />

            <SectionCard title="Review volume">
              {data.volume.length > 1
                ? <Sparkline values={data.volume.map((v) => v.count)} height={56} />
                : <Text style={styles.none}>Not enough data for this period</Text>}
            </SectionCard>

            <SectionCard title="Rating distribution">
              {[5, 4, 3, 2, 1].map((star) => (
                <BarRow key={star} label={`${star} ★`} value={data.distribution[star] ?? 0} max={maxStar} color={colors.accent} />
              ))}
            </SectionCard>

            {data.storeRatingSummary.count > 0 && (
              <View style={styles.block}>
                <Text style={styles.heading}>Store ratings</Text>
                <StoreRatingSummaryTiles summary={data.storeRatingSummary} />
              </View>
            )}

            <ProductRatingList title="Top rated products" products={data.topRated} />
            <ProductRatingList title="Lowest rated products" products={data.worstRated} />
          </>
        )}
      </AsyncBody>
    </ManageStackScreen>
  );
}

export default function ReviewAnalyticsScreen() {
  return <AccessGate resource="review-analytics"><ReviewAnalytics /></AccessGate>;
}

const styles = StyleSheet.create({
  none: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  block: { gap: 8 },
  heading: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase", paddingHorizontal: 2 },
});
