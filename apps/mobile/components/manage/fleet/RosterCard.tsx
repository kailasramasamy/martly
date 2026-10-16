import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { manage, tabular } from "../ui/tokens";
import { WeekdayStrip } from "./WeekdayStrip";
import { riderDays } from "./windows";
import type { FleetRider, RosterWindow } from "./types";

interface RosterCardProps {
  windows: RosterWindow[];
  riders: FleetRider[];
  onEdit: (window: RosterWindow) => void;
}

function RiderChips({ window, riders }: { window: RosterWindow; riders: FleetRider[] }) {
  const days = riderDays(window);
  if (days.size === 0) return <Text style={styles.empty}>No riders yet</Text>;
  return (
    <View style={styles.chips}>
      {riders.filter((r) => days.has(r.id)).map((r) => {
        const count = days.get(r.id) ?? 0;
        return (
          <View key={r.id} style={styles.chip}>
            <Text style={styles.chipText}>{r.name.split(" ")[0]}{count < window.slots.length ? ` · ${count}/${window.slots.length} days` : ""}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** The weekly roster: one row per time window with its weekdays and riders */
export function RosterCard({ windows, riders, onEdit }: RosterCardProps) {
  return (
    <SectionCard title="Weekly roster" flush>
      {windows.length === 0 && <Text style={styles.none}>No delivery slots yet. Add time slots first, then choose who rides them.</Text>}
      {windows.map((w) => (
        <TouchableOpacity key={w.key} style={styles.row} onPress={() => onEdit(w)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Edit riders for ${w.label}`}>
          <View style={styles.head}>
            <Text style={[styles.time, tabular]}>{w.label}</Text>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </View>
          <WeekdayStrip available={new Set(w.slots.map((s) => s.dayOfWeek))} />
          <RiderChips window={w} riders={riders} />
        </TouchableOpacity>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, padding: 14, minHeight: 64, borderTopWidth: 1, borderTopColor: manage.hairline },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: manage.tint, justifyContent: "center" },
  chipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.primary },
  empty: { fontFamily: fonts.medium, fontSize: 13, color: manage.attentionText },
  none: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, padding: 14 },
});
