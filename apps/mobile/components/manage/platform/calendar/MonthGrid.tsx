import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { fromDateKey, toDateKey } from "../../ui/dates";
import { manage, tabular } from "../../ui/tokens";
import type { Campaign } from "../types";
import { monthCells, type MonthCursor } from "./calendar-data";
import { campaignColor } from "./package-colors";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_DOTS = 4;
const WEEKEND = new Set([0, 6]);

interface MonthGridProps {
  cursor: MonthCursor;
  byDay: Map<string, Campaign[]>;
  selected: string;
  onSelect: (dateKey: string) => void;
}

// One dot per package type running that day, so a busy day reads at a glance without a wall of bars
const typeColors = (campaigns: Campaign[]) => [...new Set(campaigns.map(campaignColor))].slice(0, MAX_DOTS);

function DayCell({ dayKey, campaigns, selected, today, onSelect }: { dayKey: string; campaigns: Campaign[]; selected: boolean; today: boolean; onSelect: () => void }) {
  const date = fromDateKey(dayKey);
  return (
    <TouchableOpacity
      style={[styles.cell, WEEKEND.has(date.getDay()) && styles.weekend]}
      onPress={onSelect}
      activeOpacity={0.7}
      accessibilityLabel={`${dayKey}, ${campaigns.length} campaigns`}
    >
      <View style={[styles.day, selected && styles.daySelected, today && !selected && styles.dayToday]}>
        <Text style={[styles.dayText, tabular, selected && styles.dayTextSelected, today && !selected && styles.dayTextToday]}>{date.getDate()}</Text>
      </View>
      <View style={styles.dots}>
        {typeColors(campaigns).map((color) => <View key={color} style={[styles.dot, { backgroundColor: color }]} />)}
      </View>
      <Text style={[styles.count, tabular]}>{campaigns.length || ""}</Text>
    </TouchableOpacity>
  );
}

export function MonthGrid({ cursor, byDay, selected, onSelect }: MonthGridProps) {
  const today = toDateKey(new Date());
  const cells = monthCells(cursor);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return (
    <View style={styles.grid}>
      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={[styles.weekday, WEEKEND.has(i) && styles.weekdayEnd]}>{w}</Text>)}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={[styles.week, styles.weekLine]}>
          {week.map((key, i) => key
            ? <DayCell key={key} dayKey={key} campaigns={byDay.get(key) ?? []} selected={key === selected} today={key === today} onSelect={() => onSelect(key)} />
            : <View key={`pad-${i}`} style={[styles.cell, WEEKEND.has(i) && styles.weekend]} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { backgroundColor: manage.card, borderRadius: 16, borderWidth: 1, borderColor: manage.line, overflow: "hidden" },
  week: { flexDirection: "row" },
  weekLine: { borderTopWidth: 1, borderTopColor: manage.hairline },
  weekday: { flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, color: manage.muted, paddingVertical: 10 },
  weekdayEnd: { color: colors.textSecondary },
  cell: { flex: 1, height: 64, alignItems: "center", paddingTop: 6 },
  weekend: { backgroundColor: "#f8fafc" },
  day: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { backgroundColor: manage.tint },
  dayText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  dayTextSelected: { color: "#fff", fontFamily: fonts.bold },
  dayTextToday: { color: colors.primary, fontFamily: fonts.extrabold },
  dots: { flexDirection: "row", gap: 3, height: 6, marginTop: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  count: { fontFamily: fonts.semibold, fontSize: 10, color: manage.muted, marginTop: 2, height: 12 },
});
