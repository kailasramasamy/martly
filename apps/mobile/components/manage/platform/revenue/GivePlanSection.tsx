import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { formatDate } from "./types";

export type PlanCode = "GROWTH" | "PRO";

const PLANS: { value: PlanCode; label: string; detail: string }[] = [
  { value: "GROWTH", label: "Growth", detail: "2 promotions a month" },
  { value: "PRO", label: "Pro", detail: "6 promotions a month" },
];
const DURATIONS = [{ days: 30, chip: "1 mo", label: "1 month" }, { days: 90, chip: "3 mo", label: "3 months" }, { days: 182, chip: "6 mo", label: "6 months" }, { days: 365, chip: "1 yr", label: "1 year" }];
const DAY_MS = 24 * 60 * 60 * 1000;
const durationLabel = (days: number) => DURATIONS.find((d) => d.days === days)?.label ?? `${days} days`;

function PlanOption({ plan, active, onPress }: { plan: (typeof PLANS)[number]; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.option, active && styles.optionActive]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <View style={styles.optionHead}>
        <Text style={styles.optionLabel}>{plan.label}</Text>
        <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? colors.primary : "#94a3b8"} />
      </View>
      <Text style={styles.optionDetail}>{plan.detail}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Martly gives a store Growth or Pro for a while, starting now and with no payment */
export function GivePlanSection({ running, onGive }: { running: boolean; onGive: (plan: PlanCode, days: number) => void }) {
  const [plan, setPlan] = useState<PlanCode>("PRO");
  const [preset, setPreset] = useState<number | null>(365);
  const [custom, setCustom] = useState("");
  const days = preset ?? Number(custom);
  const valid = Number.isInteger(days) && days >= 1 && days <= 730;
  const name = PLANS.find((p) => p.value === plan)!.label;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Give a plan</Text>
      <View style={styles.options}>{PLANS.map((p) => <PlanOption key={p.value} plan={p} active={p.value === plan} onPress={() => setPlan(p.value)} />)}</View>
      <View style={styles.chips}>
        {DURATIONS.map((d) => <Chip key={d.days} label={d.chip} active={preset === d.days} onPress={() => setPreset(d.days)} />)}
        <Chip label="Custom" active={preset === null} onPress={() => setPreset(null)} />
      </View>
      {preset === null ? <TextField label="Days" keyboardType="number-pad" value={custom} onChangeText={setCustom} maxLength={3} error={custom && !valid ? "Enter 1 to 730 days" : undefined} /> : null}
      {valid ? <Text style={styles.summary}>{`${name} until ${formatDate(new Date(Date.now() + days * DAY_MS).toISOString())} · starts now, no payment`}</Text> : null}
      <Button label={valid ? `Give ${name} for ${durationLabel(days)}` : "Give plan"} icon="gift-outline" onPress={() => onGive(plan, days)} loading={running} disabled={!valid} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase" },
  options: { flexDirection: "row", gap: 10 },
  option: { flex: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, padding: 12, backgroundColor: "#fff" },
  optionActive: { borderWidth: 2, borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  optionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionLabel: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  optionDetail: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 4 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { flexGrow: 1, alignItems: "center", minHeight: 40, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: manage.line, backgroundColor: "#fff", justifyContent: "center" },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  chipTextActive: { color: "#fff" },
  summary: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
