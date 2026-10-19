import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { formatINR, manage, tabular } from "../ui/tokens";
import { minutesText, navigateUrl, orderRef, stopWindow } from "./format";
import type { RiderStop } from "./types";

interface NextStopCardProps {
  stop: RiderStop;
  position: number;
  total: number;
  etaSeconds: number | null;
  onFail: () => void;
  onOpen: () => void;
}

type Tone = "cash" | "plain" | "collect";

function Chip({ icon, label, tone, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: Tone; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, styles[tone]]} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={16} color={tone === "plain" ? colors.text : manage.attentionText} />
      <Text style={[styles.chipText, tone !== "plain" && styles.chipTextWarm, tabular]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** What this stop involves, as tappable chips that open the stop's details */
function Chips({ stop, onOpen }: { stop: RiderStop; onOpen: () => void }) {
  const units = stop.items.reduce((n, i) => n + i.quantity, 0);
  const returns = stop.pickups.flatMap((p) => p.items).reduce((n, i) => n + i.quantity, 0);
  return (
    <View style={styles.chips}>
      <Chip icon="cash-outline" tone={stop.amountDue > 0 ? "cash" : "plain"} label={stop.amountDue > 0 ? `Collect ${formatINR(stop.amountDue)}` : "Paid"} onPress={onOpen} />
      <Chip icon="bag-handle-outline" tone="plain" label={`${units} item${units === 1 ? "" : "s"}`} onPress={onOpen} />
      {returns > 0 && <Chip icon="return-down-back-outline" tone="collect" label={`${returns} to collect`} onPress={onOpen} />}
    </View>
  );
}

/** The stop to ride to now: who and where, then the two things a rider does on the way — navigate and call */
export function NextStopCard({ stop, position, total, etaSeconds, onFail, onOpen }: NextStopCardProps) {
  const url = navigateUrl(stop);
  const phone = stop.user.phone;
  const window = stopWindow(stop);
  return (
    <View style={styles.card}>
      <View style={styles.label}>
        <Text style={[styles.labelText, tabular]}>NEXT STOP · {position} OF {total}</Text>
        {etaSeconds !== null && <Text style={[styles.labelEta, tabular]}>{minutesText(etaSeconds)} away</Text>}
      </View>
      <View style={styles.body}>
        <TouchableOpacity onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${stop.user.name}, details`}>
          <Text style={styles.name}>{stop.user.name}</Text>
          <Text style={[styles.ref, tabular]}>{orderRef(stop.id)}{window ? ` · Window ${window}` : ""}</Text>
          <Text style={styles.address}>{stop.deliveryAddress ?? "No address"}</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          {url ? <Button label="Navigate" icon="navigate" onPress={() => Linking.openURL(url)} style={styles.big} /> : null}
          {phone ? <Button label="Call" icon="call" variant="secondary" onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.big} /> : null}
        </View>
        <Chips stop={stop} onOpen={onOpen} />
        {stop.deliveryNotes ? (
          <View style={styles.notes}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={manage.attentionText} />
            <Text style={styles.notesText} numberOfLines={2}>{stop.deliveryNotes}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.fail} onPress={onFail} accessibilityRole="button">
          <Text style={styles.failText}>Couldn't deliver?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.primary, overflow: "hidden" },
  label: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8 },
  labelText: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 1, color: "#fff" },
  labelEta: { fontFamily: fonts.extrabold, fontSize: 14, color: "#fff" },
  body: { padding: 16, gap: 14 },
  name: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text },
  ref: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  address: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, color: colors.text, marginTop: 6 },
  row: { flexDirection: "row", gap: 10 },
  big: { flex: 1, height: 56 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 20 },
  cash: { backgroundColor: colors.accent },
  plain: { backgroundColor: manage.canvas, borderWidth: 1, borderColor: manage.line },
  collect: { backgroundColor: manage.attentionBg },
  chipText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  chipTextWarm: { color: manage.attentionText },
  notes: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 10, backgroundColor: manage.attentionBg },
  notesText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: manage.attentionText },
  fail: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  failText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.error },
});
