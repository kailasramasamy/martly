import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DELIVERY_FAILURE_LABELS, DeliveryFailureReason } from "@martly/shared/constants";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { manage } from "../ui/tokens";
import { colors, fonts, radius } from "../../../constants/theme";

const REASONS = Object.keys(DELIVERY_FAILURE_LABELS) as DeliveryFailureReason[];

interface FailDeliverySheetProps {
  visible: boolean;
  /** Who the order was for, shown in the title */
  customer: string;
  running: boolean;
  onClose: () => void;
  onConfirm: (reason: DeliveryFailureReason, note: string | undefined) => void;
}

function ReasonOption({ reason, active, onPress }: { reason: DeliveryFailureReason; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.option, active && styles.optionActive]} onPress={onPress} activeOpacity={0.8} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={22} color={active ? colors.error : manage.muted} />
      <Text style={styles.optionText}>{DELIVERY_FAILURE_LABELS[reason]}</Text>
    </TouchableOpacity>
  );
}

/** Why an order couldn't be handed over; it goes back to the store. "Other" needs a note. Used by riders and dispatchers. */
export function FailDeliverySheet({ visible, customer, running, onClose, onConfirm }: FailDeliverySheetProps) {
  const [reason, setReason] = useState<DeliveryFailureReason | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) return;
    setReason(null);
    setNote("");
  }, [visible]);

  const trimmed = note.trim();
  const ready = reason !== null && (reason !== "OTHER" || trimmed.length > 0);
  const footer = (
    <View style={styles.footer}>
      <Button label="Back" variant="secondary" onPress={onClose} style={styles.flex} />
      <Button label="Couldn't deliver" variant="destructive" disabled={!ready} loading={running} onPress={() => reason && onConfirm(reason, trimmed || undefined)} style={styles.flex} />
    </View>
  );

  return (
    <BottomSheet scrollable visible={visible} title={`Couldn't deliver to ${customer}`} onClose={onClose} footer={footer}>
      <View style={styles.body}>
        <Text style={styles.hint}>The order goes back to the store and is taken off this trip.</Text>
        {REASONS.map((r) => <ReasonOption key={r} reason={r} active={reason === r} onPress={() => setReason(r)} />)}
        {reason ? <TextField label="Note" required={reason === "OTHER"} value={note} onChangeText={setNote} placeholder="What happened?" maxLength={500} /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8, paddingBottom: 4 },
  hint: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, marginBottom: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card },
  optionActive: { borderColor: colors.error, backgroundColor: "#fef2f2" },
  optionText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  footer: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
