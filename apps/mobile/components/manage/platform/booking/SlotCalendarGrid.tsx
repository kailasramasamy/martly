import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { manage, tabular } from "../../ui/tokens";
import { fromDateKey } from "../../ui/dates";
import { TONES } from "../../marketing/common";
import type { CalendarDay } from "../types";
import { dayState, type DayState } from "./slot-days";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const TINT: Record<DayState, { bg: string; fg: string }> = {
  open: { bg: TONES.green.bg, fg: TONES.green.color },
  later: { bg: TONES.amber.bg, fg: TONES.amber.color },
  full: { bg: TONES.red.bg, fg: TONES.red.color },
};

interface Props {
  days: CalendarDay[];
  cap: number | null;
  todayKey: string;
  /** Day currently inspected or chosen */
  selected: string | null;
  onPick: (day: CalendarDay) => void;
}

/** Sunday-first cells for one month: nulls pad the first week */
function monthCells(year: number, month: number): (string | null)[] {
  const pad = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const mm = String(month + 1).padStart(2, "0");
  return [...Array(pad).fill(null), ...Array.from({ length: count }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, "0")}`)];
}

function DayCell({ day, cap, todayKey, selected, date, onPick }: Omit<Props, "days"> & { day?: CalendarDay; date: string }) {
  const state = day ? dayState(day, todayKey) : null;
  const tint = state ? TINT[state] : null;
  const isSelected = date === selected;
  return (
    <TouchableOpacity style={styles.cell} disabled={!day} onPress={() => day && onPick(day)} accessibilityLabel={date}>
      <View style={[styles.day, tint && { backgroundColor: tint.bg }, isSelected && styles.daySelected]}>
        <Text style={[styles.dayText, !tint && styles.out, tint && { color: tint.fg }, state === "full" && styles.struck, isSelected && styles.selectedText]}>
          {Number(date.slice(8))}
        </Text>
        {day && cap !== null ? <Text style={[styles.count, tabular, tint && { color: tint.fg }, isSelected && styles.selectedText]}>{day.booked}/{cap}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/** Month grid over the returned days with prev/next buttons; days outside the range are greyed */
export function SlotCalendarGrid({ days, cap, todayKey, selected, onPick }: Props) {
  const first = fromDateKey(days[0]?.date ?? todayKey);
  const last = fromDateKey(days[days.length - 1]?.date ?? todayKey);
  const firstIndex = first.getFullYear() * 12 + first.getMonth();
  const lastIndex = last.getFullYear() * 12 + last.getMonth();
  const start = fromDateKey(selected ?? todayKey);
  const [index, setIndex] = useState(start.getFullYear() * 12 + start.getMonth());
  const year = Math.floor(index / 12);
  const month = index % 12;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const title = new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity style={styles.nav} disabled={index <= firstIndex} onPress={() => setIndex(index - 1)} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={20} color={index <= firstIndex ? manage.line : colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity style={styles.nav} disabled={index >= lastIndex} onPress={() => setIndex(index + 1)} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={20} color={index >= lastIndex ? manage.line : colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekday}>{w}</Text>)}
        {monthCells(year, month).map((date, i) =>
          date ? <DayCell key={date} date={date} day={byDate.get(date)} cap={cap} todayKey={todayKey} selected={selected} onPick={onPick} /> : <View key={`pad${i}`} style={styles.cell} />,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  nav: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", fontFamily: fonts.bold, fontSize: 11, color: manage.muted, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: "center", justifyContent: "center" },
  day: { width: 44, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  out: { color: manage.line },
  struck: { textDecorationLine: "line-through" },
  count: { fontFamily: fonts.medium, fontSize: 9, marginTop: -1 },
  selectedText: { color: "#fff" },
});
