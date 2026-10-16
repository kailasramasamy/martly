import { View, Text, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { manage, tabular } from "../ui/tokens";
import { AmountTag } from "./AmountTag";
import { minutesText, navigateUrl, stopWindow } from "./format";
import type { RiderStop } from "./types";

interface NextStopCardProps {
  stop: RiderStop;
  position: number;
  total: number;
  etaSeconds: number | null;
  onDeliver: () => void;
  onFail: () => void;
  onOpen: () => void;
}

function Notes({ text }: { text: string }) {
  return (
    <View style={styles.notes}>
      <Ionicons name="chatbubble-ellipses-outline" size={18} color={manage.attentionText} />
      <Text style={styles.notesText}>{text}</Text>
    </View>
  );
}

function Facts({ stop, etaSeconds }: { stop: RiderStop; etaSeconds: number | null }) {
  const window = stopWindow(stop);
  return (
    <View style={styles.facts}>
      {etaSeconds !== null && <Text style={[styles.eta, tabular]}>{minutesText(etaSeconds)} away</Text>}
      {window && <Text style={[styles.window, tabular]}>Window {window}</Text>}
    </View>
  );
}

function ContactRow({ stop, onOpen }: { stop: RiderStop; onOpen: () => void }) {
  const url = navigateUrl(stop);
  const phone = stop.user.phone;
  return (
    <View style={styles.row}>
      {phone ? <Button label="Call" icon="call" variant="secondary" style={styles.flex} onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
      {url ? <Button label="Navigate" icon="navigate" variant="secondary" style={styles.flex} onPress={() => Linking.openURL(url)} /> : null}
      <Button label={`${stop.items.length} item${stop.items.length === 1 ? "" : "s"}`} icon="receipt-outline" variant="secondary" style={styles.flex} onPress={onOpen} />
    </View>
  );
}

/** The one stop to do now: who, where, what to collect, and the four things a rider does there */
export function NextStopCard({ stop, position, total, etaSeconds, onDeliver, onFail, onOpen }: NextStopCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.label}>
        <Text style={[styles.labelText, tabular]}>NEXT STOP · {position} OF {total}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} onPress={onOpen} accessibilityRole="button">{stop.user.name}</Text>
        <Text style={styles.address} onPress={onOpen}>{stop.deliveryAddress ?? "No address"}</Text>
        <Facts stop={stop} etaSeconds={etaSeconds} />
        <AmountTag due={stop.amountDue} large />
        {stop.deliveryNotes ? <Notes text={stop.deliveryNotes} /> : null}
        <ContactRow stop={stop} onOpen={onOpen} />
        <Button
          label="Mark delivered"
          icon="checkmark"
          onPress={onDeliver}
          style={styles.deliver}
        />
        <Button label="Couldn't deliver" variant="danger" onPress={onFail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.primary, overflow: "hidden" },
  label: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8 },
  labelText: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 1, color: "#fff" },
  body: { padding: 16, gap: 12 },
  name: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  address: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: colors.text, marginTop: -6 },
  facts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  eta: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.primary },
  window: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  notes: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, backgroundColor: manage.attentionBg },
  notesText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: manage.attentionText },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  deliver: { height: 56 },
});
