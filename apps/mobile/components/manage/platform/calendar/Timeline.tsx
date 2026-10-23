import { useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../../constants/theme";
import { EmptyState } from "../../ui/EmptyState";
import { manage, tabular } from "../../ui/tokens";
import type { Campaign } from "../types";
import { dateRange, progressLabel } from "../campaigns/campaign-utils";
import { daysInMonth, isUnconfirmed, monthBars, type Bar, type MonthCursor } from "./calendar-data";
import { campaignColor } from "./package-colors";

// Days labelled on the ruler; the whole month fits the screen width, so nothing scrolls sideways
const RULER_DAYS = [1, 8, 15, 22, 29];

interface Group { name: string; color: string; bars: Bar[] }

function buildGroups(campaigns: Campaign[], cursor: MonthCursor): Group[] {
  const groups = new Map<string, Group>();
  monthBars(campaigns, cursor).forEach((bar) => {
    const name = bar.campaign.product.name;
    const group = groups.get(name) ?? { name, color: campaignColor(bar.campaign), bars: [] };
    group.bars.push(bar);
    groups.set(name, group);
  });
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const pct = (days: number, value: number) => `${(value / days) * 100}%` as const;

function Ruler({ days, todayDay }: { days: number; todayDay: number | null }) {
  return (
    <View style={styles.ruler}>
      {RULER_DAYS.filter((d) => d <= days && (!todayDay || Math.abs(d - todayDay) > 2)).map((d) => (
        <Text key={d} style={[styles.tick, tabular, { left: pct(days, d - 1) }]}>{d}</Text>
      ))}
      {todayDay ? <Text style={[styles.tick, styles.todayTick, tabular, { left: pct(days, todayDay - 1) }]}>Today</Text> : null}
    </View>
  );
}

function CampaignRow({ bar, color, days, todayDay }: { bar: Bar; color: string; days: number; todayDay: number | null }) {
  const router = useRouter();
  const { campaign, from, to } = bar;
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={() => router.push(`/manage/brand-campaigns/${campaign.id}`)}>
      <View style={styles.rowHead}>
        {campaign.brand.imageUrl ? <Image source={{ uri: campaign.brand.imageUrl }} style={styles.logo} resizeMode="contain" /> : null}
        <Text style={styles.brand} numberOfLines={1}>{campaign.brand.name}</Text>
        <Text style={[styles.dates, tabular]}>{dateRange(campaign)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.bar, { left: pct(days, from - 1), width: pct(days, to - from + 1), backgroundColor: color }, isUnconfirmed(campaign) && styles.barLight]} />
        {todayDay ? <View style={[styles.todayLine, { left: pct(days, todayDay - 0.5) }]} /> : null}
      </View>
      <Text style={styles.progress}>{progressLabel(campaign)}</Text>
    </TouchableOpacity>
  );
}

/** Each campaign on its own row with a bar across the month, grouped by package when several are shown */
export function Timeline({ campaigns, cursor }: { campaigns: Campaign[]; cursor: MonthCursor }) {
  const groups = useMemo(() => buildGroups(campaigns, cursor), [campaigns, cursor]);
  const days = daysInMonth(cursor);
  const now = new Date();
  const todayDay = now.getFullYear() === cursor.y && now.getMonth() === cursor.m ? now.getDate() : null;

  if (!groups.length) return <EmptyState icon="calendar-outline" title="No campaigns this month" message="Gaps are free slots. Try another month or filter." />;
  return (
    <View>
      <Ruler days={days} todayDay={todayDay} />
      {groups.map((g) => (
        <View key={g.name}>
          {groups.length > 1 ? (
            <View style={styles.groupHead}>
              <View style={[styles.dot, { backgroundColor: g.color }]} />
              <Text style={styles.groupName}>{g.name}</Text>
              <Text style={styles.groupCount}>{g.bars.length}</Text>
            </View>
          ) : null}
          {g.bars.map((b) => <CampaignRow key={b.campaign.id} bar={b} color={g.color} days={days} todayDay={todayDay} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The ruler lines up with the cards' bars, so it shares their inner padding
  ruler: { height: 26, marginHorizontal: 14, marginBottom: 4 },
  tick: { position: "absolute", top: 8, fontFamily: fonts.semibold, fontSize: 11, color: manage.muted },
  todayTick: { color: colors.primary, fontFamily: fonts.bold },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 12, paddingBottom: 8, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  groupName: { flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.text, textTransform: "uppercase", letterSpacing: 0.4 },
  groupCount: { fontFamily: fonts.semibold, fontSize: 12, color: manage.muted },
  row: {
    minHeight: 44, padding: 14, gap: 8, marginBottom: 10,
    backgroundColor: manage.card, borderRadius: 12, borderWidth: 1, borderColor: manage.line,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 32, height: 18 },
  brand: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  dates: { fontFamily: fonts.medium, fontSize: 12, color: manage.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: manage.hairline },
  bar: { position: "absolute", top: 0, bottom: 0, borderRadius: 4 },
  barLight: { opacity: 0.45 },
  progress: { fontFamily: fonts.medium, fontSize: 11.5, color: manage.muted },
  todayLine: { position: "absolute", top: -3, bottom: -3, width: 2, marginLeft: -1, backgroundColor: colors.primary },
});
