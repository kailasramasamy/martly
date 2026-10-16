import { View, StyleSheet } from "react-native";
import { SelectField } from "../ui/SelectField";
import type { SelectOption } from "../ui/OptionSheet";
import { FieldFrame, type FieldFrameProps } from "../ui/FieldFrame";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS: SelectOption[] = Array.from({ length: 24 }, (_, h) => ({ value: pad(h), label: pad(h) }));
const MINUTE_STEP = 5;

interface TimeSelectProps extends FieldFrameProps {
  /** "HH:mm" or null when unset */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Adds a "Not set" choice that clears the time */
  optional?: boolean;
}

/** Hour + minute pair of SelectFields producing "HH:mm" */
export function TimeSelect({ value, onChange, optional, label, required, hint, error }: TimeSelectProps) {
  const [hour, minute] = value ? value.split(":") : [null, null];
  const minutes: SelectOption[] = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => ({ value: pad(i * MINUTE_STEP), label: pad(i * MINUTE_STEP) }));
  if (minute && !minutes.some((m) => m.value === minute)) minutes.push({ value: minute, label: minute });
  const hours = optional ? [{ value: "", label: "Not set" }, ...HOURS] : HOURS;

  const pickHour = (h: string) => onChange(h === "" ? null : `${h}:${minute ?? "00"}`);
  const pickMinute = (m: string) => onChange(`${hour ?? "00"}:${m}`);

  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <View style={styles.row}>
        <View style={styles.cell}><SelectField label="Hour" value={hour ?? (optional ? "" : null)} options={hours} onChange={pickHour} placeholder="--" /></View>
        <View style={styles.cell}><SelectField label="Minute" value={minute} options={minutes} onChange={pickMinute} placeholder="--" disabled={optional && !hour} /></View>
      </View>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  cell: { flex: 1 },
});
