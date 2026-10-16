import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { StatusPill } from "../../ui/StatusPill";
import { ORDER_STATUS, manage, tabular } from "../../ui/tokens";
import { deliveredText, failureText, minutesText } from "../../rider/format";
import type { PlanStop } from "./types";

interface StopRowProps {
  stop: PlanStop;
  /** Position on the trip; pool orders have none */
  index?: number;
  onPress: () => void;
  /** Unstarted trips only: shows a Move action */
  onMove?: () => void;
  /** Out-for-delivery stops on a running trip: shows a Couldn't deliver action */
  onFail?: () => void;
  /** On-the-road trips: the rider's next stop, and when they'll reach each one */
  current?: boolean;
  etaSeconds?: number | null;
}

function Eta({ current, etaSeconds }: { current?: boolean; etaSeconds?: number | null }) {
  if (!current && etaSeconds == null) return null;
  const parts = [current ? "Next" : null, etaSeconds != null ? minutesText(etaSeconds) : null].filter(Boolean);
  return <Text style={[styles.eta, tabular]} numberOfLines={1}>{parts.join(" · ")}</Text>;
}

/** Compact stop: number, customer, address and status; the whole row opens the order menu */
export function StopRow({ stop, index, onPress, onMove, onFail, current, etaSeconds }: StopRowProps) {
  const failure = stop.deliveryFailures?.[0];
  const done = stop.status === "DELIVERED" ? deliveredText(stop) : null;
  return (
    <View style={[styles.row, current && styles.current]}>
      <TouchableOpacity style={styles.main} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Order for ${stop.user.name}`}>
        {index !== undefined && <Text style={[styles.seq, tabular]}>{index + 1}</Text>}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{stop.user.name}</Text>
          <Text style={styles.address} numberOfLines={1}>{stop.deliveryAddress ?? "No address"}</Text>
          {failure && <Text style={styles.failed} numberOfLines={1}>Failed: {failureText(failure)}</Text>}
          {done && <Text style={[styles.paid, tabular]} numberOfLines={1}>{done}</Text>}
          <Eta current={current} etaSeconds={etaSeconds} />
        </View>
        <StatusPill {...ORDER_STATUS[stop.status]} />
      </TouchableOpacity>
      {onFail && (
        <TouchableOpacity style={styles.fail} onPress={onFail} accessibilityRole="button" accessibilityLabel="Couldn't deliver">
          <Text style={styles.failLabel}>Couldn't deliver</Text>
        </TouchableOpacity>
      )}
      {onMove && (
        <TouchableOpacity style={styles.move} onPress={onMove} accessibilityRole="button" accessibilityLabel="Move order">
          <Text style={styles.moveLabel}>Move</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: manage.hairline },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingLeft: 14, paddingVertical: 8, paddingRight: 8 },
  seq: { width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, fontFamily: fonts.extrabold, fontSize: 12, color: colors.primary, backgroundColor: manage.tint, overflow: "hidden" },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  address: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  current: { backgroundColor: "#f0fdfa" },
  eta: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary, marginTop: 2 },
  paid: { fontFamily: fonts.semibold, fontSize: 12.5, color: "#15803d", marginTop: 1 },
  failed: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.error, marginTop: 1 },
  fail: { width: 72, minHeight: 56, alignItems: "center", justifyContent: "center", paddingRight: 8 },
  failLabel: { fontFamily: fonts.bold, fontSize: 12, textAlign: "center", color: colors.error },
  move: { minWidth: 56, minHeight: 56, alignItems: "center", justifyContent: "center", paddingRight: 8 },
  moveLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
