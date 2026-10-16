import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { manage } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";

const OTHER = "Other";

export interface ReasonPreset {
  title: string;
  warning: string;
  question: string;
  reasons: string[];
  confirmLabel: string;
  keepLabel: string;
}

export const CANCEL_ORDER: ReasonPreset = {
  title: "Cancel this order?",
  warning: "The customer is notified, any payment is refunded and reserved stock is released. This can't be undone.",
  question: "Why are you cancelling?",
  reasons: ["Out of stock", "Customer asked to cancel", "Can't deliver to address", "Payment issue", "Store closed"],
  confirmLabel: "Cancel order",
  keepLabel: "Keep order",
};

export const UNDO_DELIVERY: ReasonPreset = {
  title: "Undo delivery?",
  warning: "The order goes back a step, sold stock is put back, cash-on-delivery returns to unpaid and loyalty points are taken back. The customer is told the status was corrected.",
  question: "What happened?",
  reasons: ["Marked by mistake", "Customer didn't receive it", "Wrong order marked"],
  confirmLabel: "Undo delivery",
  keepLabel: "Keep delivered",
};

interface ReasonSheetProps {
  preset: ReasonPreset;
  visible: boolean;
  running: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** Confirms a serious order change with a reason (one tap for common ones); the reason is saved on the order's history */
export function ReasonSheet({ preset, visible, running, onClose, onConfirm }: ReasonSheetProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState("");

  useEffect(() => {
    if (visible) return;
    setPicked(null);
    setOther("");
  }, [visible]);

  const reason = picked === OTHER ? other.trim() : picked;
  const footer = (
    <View style={styles.footer}>
      <Button label={preset.keepLabel} variant="secondary" onPress={onClose} style={styles.flex} />
      <Button label={preset.confirmLabel} variant="destructive" disabled={!reason} loading={running} onPress={() => reason && onConfirm(reason)} style={styles.flex} />
    </View>
  );

  return (
    <BottomSheet scrollable visible={visible} title={preset.title} onClose={onClose} footer={footer}>
      <View style={styles.body}>
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={18} color={colors.error} />
          <Text style={styles.warningText}>{preset.warning}</Text>
        </View>
        <Text style={styles.label}>{preset.question}</Text>
        <View style={styles.chips}>
          {[...preset.reasons, OTHER].map((r) => {
            const active = picked === r;
            return (
              <TouchableOpacity key={r} style={[styles.chip, active && styles.chipActive]} onPress={() => setPicked(r)} activeOpacity={0.8} accessibilityRole="radio" accessibilityState={{ selected: active }}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {picked === OTHER && <TextField label="Reason" required value={other} onChangeText={setOther} placeholder="Add a short note" maxLength={500} />}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingBottom: 4, gap: 14 },
  warning: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#fef2f2" },
  warningText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: "#991b1b" },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextActive: { color: "#fff" },
  footer: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
