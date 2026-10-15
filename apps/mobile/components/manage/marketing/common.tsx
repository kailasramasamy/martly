import { useState } from "react";
import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { colors, fonts } from "../../../constants/theme";
import { toDateKey } from "../ui/dates";
import { DateField } from "../ui/DateField";
import { manage } from "../ui/tokens";

export interface Tone {
  label: string;
  color: string;
  bg: string;
}

export const TONES = {
  green: { color: "#15803d", bg: "#dcfce7" },
  amber: { color: "#b45309", bg: "#fef3c7" },
  red: { color: "#b91c1c", bg: "#fee2e2" },
  blue: { color: "#1d4ed8", bg: "#dbeafe" },
  slate: { color: "#475569", bg: "#e2e8f0" },
  violet: { color: "#6d28d9", bg: "#ede9fe" },
} as const;

export const CAMPAIGN_STATUS: Record<string, Tone> = {
  DRAFT: { label: "Draft", ...TONES.slate },
  SCHEDULED: { label: "Scheduled", ...TONES.blue },
  SENDING: { label: "Sending", ...TONES.amber },
  SENT: { label: "Sent", ...TONES.green },
  FAILED: { label: "Failed", ...TONES.red },
};

export const startOfDayIso = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toISOString();
export const endOfDayIso = (dateKey: string) => new Date(`${dateKey}T23:59:59.999`).toISOString();
export const isoToDateKey = (iso: string | null | undefined) => (iso ? toDateKey(new Date(iso)) : null);

/** Empty text becomes null, anything else a number (NaN becomes null too) */
export function parseNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export const numberText = (n: number | string | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** Uppercase group label between list rows */
export function GroupHeader({ label }: { label: string }) {
  return <Text style={styles.group}>{label}</Text>;
}

interface OptionalDateProps {
  label: string;
  value: string | null;
  onChange: (dateKey: string | null) => void;
  placeholder?: string;
  minDate?: string;
  error?: string | null;
}

/** DateField that can also be cleared back to "no date" */
export function OptionalDate({ onChange, ...field }: OptionalDateProps) {
  return (
    <View>
      <DateField {...field} onChange={onChange} />
      {field.value ? (
        <TouchableOpacity style={styles.clear} onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={`Clear ${field.label}`}>
          <Text style={styles.clearText}>Clear date</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface DeleteButtonProps {
  title: string;
  message: string;
  label?: string;
  running: boolean;
  onConfirm: () => Promise<unknown>;
}

/** Danger button that asks for confirmation before running the destructive call */
export function DeleteButton({ title, message, label = "Delete", running, onConfirm }: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const confirm = async () => {
    await onConfirm();
    setOpen(false);
  };
  return (
    <>
      <Button label={label} variant="danger" icon="trash-outline" onPress={() => setOpen(true)} style={styles.btn} />
      <ConfirmDialog visible={open} title={title} message={message} confirmLabel={label} running={running} onConfirm={confirm} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1 },
  group: {
    fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase",
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6, backgroundColor: manage.canvas,
  },
  clear: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center", marginBottom: 6 },
  clearText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
