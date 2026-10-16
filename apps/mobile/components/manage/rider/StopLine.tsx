import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { AmountTag } from "./AmountTag";
import { deliveredText, failureText, minutesText } from "./format";
import type { RiderFailure, RiderStop } from "./types";

function Badge({ children, tone }: { children: ReactNode; tone: "todo" | "done" | "failed" }) {
  return <View style={[styles.badge, tone === "done" && styles.badgeDone, tone === "failed" && styles.badgeFailed]}>{children}</View>;
}

/** A stop still to do: number, who and where, ETA, and what to collect */
export function PendingStopLine({ stop, number, current, etaSeconds, onPress }: { stop: RiderStop; number: number; current?: boolean; etaSeconds: number | null; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.row, current && styles.current]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Stop ${number}, ${stop.user.name}`}>
      <Badge tone="todo"><Text style={[styles.number, tabular]}>{number}</Text></Badge>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{stop.user.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{stop.deliveryAddress ?? "No address"}</Text>
      </View>
      <View style={styles.right}>
        {current && <Text style={styles.now}>NOW</Text>}
        {etaSeconds !== null && <Text style={[styles.eta, tabular]}>{minutesText(etaSeconds)}</Text>}
        {isPacked(stop) ? <AmountTag due={stop.amountDue} /> : <PackingTag />}
      </View>
    </TouchableOpacity>
  );
}

/** Orders the store hasn't finished packing yet; the trip can't leave until there are none */
export const isPacked = (stop: RiderStop) => stop.status === "READY" || stop.status === "OUT_FOR_DELIVERY" || stop.status === "DELIVERED";

function PackingTag() {
  return (
    <View style={styles.packing}>
      <Ionicons name="time-outline" size={14} color="#1d4ed8" />
      <Text style={styles.packingText}>Packing</Text>
    </View>
  );
}

export function DeliveredStopLine({ stop, onPress }: { stop: RiderStop; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${stop.user.name}, delivered`}>
      <Badge tone="done"><Ionicons name="checkmark" size={16} color="#15803d" /></Badge>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{stop.user.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{stop.deliveryAddress ?? "No address"}</Text>
        <Text style={styles.done} numberOfLines={1}>{deliveredText(stop)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function FailedStopLine({ failure }: { failure: RiderFailure }) {
  return (
    <View style={styles.row}>
      <Badge tone="failed"><Ionicons name="close" size={16} color={colors.error} /></Badge>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{failure.order.user.name}</Text>
        <Text style={styles.failed} numberOfLines={2}>Not delivered: {failureText(failure)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: manage.hairline },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: manage.tint },
  badgeDone: { backgroundColor: "#dcfce7" },
  badgeFailed: { backgroundColor: "#fee2e2" },
  number: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  done: { fontFamily: fonts.bold, fontSize: 13, color: "#15803d", marginTop: 2 },
  current: { backgroundColor: "#f0fdfa" },
  now: { fontFamily: fonts.extrabold, fontSize: 11.5, letterSpacing: 0.8, color: colors.primary },
  failed: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4 },
  eta: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  packing: { flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: "#dbeafe" },
  packingText: { fontFamily: fonts.extrabold, fontSize: 12.5, color: "#1d4ed8" },
});
