import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../search/BottomSheet";
import { colors, fonts } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { fieldStyles as fs } from "../../ui/fieldStyles";
import { FieldFrame } from "../../ui/FieldFrame";
import { Button } from "../../ui/Button";
import { DateField } from "../../ui/DateField";
import { formatDate, fromDateKey, toDateKey } from "../../ui/dates";
import { TONES } from "../../marketing/common";
import type { BrandPackage, CalendarDay } from "../types";
import { SlotCalendarGrid } from "./SlotCalendarGrid";
import { SlotDayDetail } from "./SlotDayDetail";
import { dayState } from "./slot-days";
import { useSlotCalendar } from "./use-slot-calendar";

interface Props {
  value: string | null;
  error?: string;
  product?: BrandPackage;
  quantity: number;
  categoryId: string | null;
  excludeId?: string;
  onChange: (patch: { startDate: string; startTime: string | null }) => void;
}

const LEGEND = [
  { label: "Open", tone: TONES.green },
  { label: "Opens later", tone: TONES.amber },
  { label: "Full", tone: TONES.red },
];

function Legend() {
  return (
    <View style={styles.legend}>
      {LEGEND.map(({ label, tone }) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: tone.bg, borderColor: tone.color }]} />
          <Text style={styles.legendText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Start date that opens a booking calendar; falls back to a plain date picker until the calendar can be known */
export function StartDateField({ value, error, product, quantity, categoryId, excludeId, onChange }: Props) {
  const { calendar, loading, failed, blocked } = useSlotCalendar({ product, quantity, categoryId, excludeId });
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<CalendarDay | null>(null);
  const todayKey = toDateKey(new Date());

  if (!calendar && !loading && !failed) {
    const hint = blocked && product && !categoryId ? "Choose a category first to see open days" : undefined;
    return <DateField label="Start date" required value={value} hint={hint} onChange={(startDate) => onChange({ startDate, startTime: null })} minDate={todayKey} error={error} />;
  }

  const show = () => { setPicked(calendar?.days.find((d) => d.date === value) ?? null); setOpen(true); };
  const canUse = picked && dayState(picked, todayKey) !== "full";
  const confirm = () => {
    if (!picked) return;
    onChange({ startDate: picked.date, startTime: picked.startsAt });
    setOpen(false);
  };
  return (
    <FieldFrame label="Start date" required error={error}>
      <TouchableOpacity style={[fs.box, !!error && fs.boxError]} onPress={show} activeOpacity={0.7} accessibilityRole="button">
        <Text style={[fs.text, !value && fs.placeholder]}>{value ? formatDate(fromDateKey(value)) : "Pick a date"}</Text>
        <Ionicons name="calendar-outline" size={18} color={manage.muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} title="Start date" onClose={() => setOpen(false)}>
        <ScrollView contentContainerStyle={styles.body}>
          {loading ? <ActivityIndicator color={colors.primary} style={styles.state} /> : null}
          {failed ? <Text style={[styles.state, styles.failed]}>Couldn't load availability. Try again in a moment.</Text> : null}
          {calendar ? (
            <>
              <SlotCalendarGrid days={calendar.days} cap={calendar.cap} todayKey={todayKey} selected={picked?.date ?? null} onPick={setPicked} />
              <Legend />
              {picked ? <SlotDayDetail day={picked} todayKey={todayKey} /> : null}
              <Button label={canUse ? `Use ${formatDate(fromDateKey(picked.date))}` : "Pick an open day"} onPress={confirm} disabled={!canUse} style={styles.confirm} />
            </>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  state: { marginVertical: 24, textAlign: "center" },
  failed: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  confirm: { marginTop: 16 },
});
