import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "./tokens";
import { toDateKey, fromDateKey } from "./dates";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
}

interface CalendarGridProps {
  value: string | null;
  onSelect: (dateKey: string) => void;
  minDate?: string;
}

export function CalendarGrid({ value, onSelect, minDate }: CalendarGridProps) {
  const initial = value ? fromDateKey(value) : new Date();
  const [cursor, setCursor] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const today = toDateKey(new Date());

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => shift(-1)} style={styles.nav} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={() => shift(1)} style={styles.nav} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekday}>{w}</Text>)}
        {monthCells(cursor.y, cursor.m).map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const key = toDateKey(d);
          const disabled = !!minDate && key < minDate;
          const selected = key === value;
          return (
            <TouchableOpacity key={i} style={styles.cell} onPress={() => onSelect(key)} disabled={disabled}>
              <View style={[styles.day, selected && styles.daySelected, key === today && !selected && styles.dayToday]}>
                <Text style={[styles.dayText, selected && styles.dayTextSelected, disabled && styles.dayDisabled]}>{d.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  nav: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", fontFamily: fonts.bold, fontSize: 11, color: manage.muted, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  dayTextSelected: { color: "#fff", fontFamily: fonts.bold },
  dayDisabled: { color: manage.line },
});
