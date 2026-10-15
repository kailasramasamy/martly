import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { PAYMENT_STATUS, manage } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";

const OPTIONS = ["PENDING", "PAID", "FAILED"] as const;

interface PaymentStatusSheetProps {
  visible: boolean;
  current: string;
  saving: boolean;
  onClose: () => void;
  onSave: (paymentStatus: string, note: string) => void;
}

export function PaymentStatusSheet({ visible, current, saving, onClose, onSave }: PaymentStatusSheetProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) return;
    setPicked(null);
    setNote("");
  }, [visible]);

  return (
    <BottomSheet
      visible={visible}
      title="Update payment status"
      onClose={onClose}
      footer={<Button label="Update payment" disabled={!picked} loading={saving} onPress={() => picked && onSave(picked, note.trim())} />}
    >
      <View style={styles.body}>
        <View style={styles.options}>
          {OPTIONS.filter((o) => o !== current).map((o) => {
            const active = picked === o;
            return (
              <TouchableOpacity key={o} style={[styles.option, active && styles.optionActive]} onPress={() => setPicked(o)} activeOpacity={0.8}>
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{PAYMENT_STATUS[o].label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Cash collected by rider" maxLength={500} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingVertical: 8 },
  options: { flexDirection: "row", gap: 10 },
  option: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center", backgroundColor: manage.card },
  optionActive: { backgroundColor: colors.text, borderColor: colors.text },
  optionText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  optionTextActive: { color: "#fff", fontFamily: fonts.bold },
});
