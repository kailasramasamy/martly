import { useState } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { DateBar } from "../delivery/DateBar";
import { fromDateKey, toDateKey } from "../ui/dates";
import { manage } from "../ui/tokens";

function dayLabel(dateKey: string): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (dateKey === toDateKey(today)) return "Today";
  if (dateKey === toDateKey(tomorrow)) return "Tomorrow";
  return fromDateKey(dateKey).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** A small header pill for the day being shown; riders live in Today, so the full picker hides in a sheet */
export function DayPicker({ value, onChange }: { value: string; onChange: (dateKey: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Showing ${dayLabel(value)}. Change day`}>
        <Ionicons name="calendar-outline" size={15} color={manage.inkText} />
        <Text style={styles.text}>{dayLabel(value)}</Text>
        <Ionicons name="chevron-down" size={14} color={manage.inkMuted} />
      </TouchableOpacity>
      <BottomSheet visible={open} title="Show trips for" onClose={() => setOpen(false)}>
        <DateBar value={value} onChange={(key) => { onChange(key); setOpen(false); }} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", marginRight: 6 },
  text: { fontFamily: fonts.semibold, fontSize: 14, color: manage.inkText },
});
