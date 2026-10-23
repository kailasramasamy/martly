import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { SegmentedTabs, type SegmentOption } from "../../ui/SegmentedTabs";
import { manage } from "../../ui/tokens";
import type { MonthCursor } from "./calendar-data";

export type CalendarView = "month" | "timeline";

const VIEWS: SegmentOption<CalendarView>[] = [
  { value: "month", label: "Month" },
  { value: "timeline", label: "Timeline" },
];

interface MonthNavProps {
  cursor: MonthCursor;
  onShift: (delta: number) => void;
  onToday: () => void;
}

interface CalendarToolbarProps {
  view: CalendarView;
  onView: (view: CalendarView) => void;
  typeOptions: SegmentOption<string>[];
  type: string;
  onType: (type: string) => void;
  showClosed: boolean;
  onShowClosed: (value: boolean) => void;
}

/** Month title with arrows and Today, sitting right above the calendar */
export function MonthNav({ cursor, onShift, onToday }: MonthNavProps) {
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return (
    <View style={styles.nav}>
      <TouchableOpacity onPress={() => onShift(-1)} style={styles.arrow} accessibilityLabel="Previous month">
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity onPress={() => onShift(1)} style={styles.arrow} accessibilityLabel="Next month">
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.spacer} />
      <TouchableOpacity onPress={onToday} style={styles.today} accessibilityRole="button">
        <Text style={styles.todayText}>Today</Text>
      </TouchableOpacity>
    </View>
  );
}

// Ended and cancelled campaigns are off by default, so the calendar shows what's live and coming
function EndedChip({ on, onToggle }: { on: boolean; onToggle: (value: boolean) => void }) {
  return (
    <TouchableOpacity
      onPress={() => onToggle(!on)}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Show ended and cancelled"
    >
      <Ionicons name={on ? "eye" : "eye-off-outline"} size={15} color={on ? colors.primary : colors.textSecondary} />
      <Text style={[styles.chipText, on && styles.chipTextOn]}>Ended</Text>
    </TouchableOpacity>
  );
}

export function CalendarToolbar(props: CalendarToolbarProps) {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.views}><SegmentedTabs options={VIEWS} value={props.view} onChange={props.onView} /></View>
        <EndedChip on={props.showClosed} onToggle={props.onShowClosed} />
      </View>
      <SegmentedTabs options={props.typeOptions} value={props.type} onChange={props.onType} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  nav: { flexDirection: "row", alignItems: "center" },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, marginHorizontal: 2 },
  spacer: { flex: 1 },
  today: { height: 36, minWidth: 44, paddingHorizontal: 14, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: manage.tint, borderWidth: 1, borderColor: colors.primary },
  todayText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  views: { flex: 1 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 44, paddingHorizontal: 14, borderRadius: 22,
    borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: manage.tint },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary },
  chipTextOn: { color: colors.primary },
});
