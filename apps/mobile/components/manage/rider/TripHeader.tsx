import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage, tabular } from "../ui/tokens";
import { TRIP_PHASE } from "../delivery/plan/format";
import { clockTime, finishText, isDelivered, tripCash, waveLabel } from "./format";
import type { RiderTrip, TripRoute } from "./types";

function subtitle(trip: RiderTrip): string {
  const parts = [trip.areaLabel ?? trip.store.name];
  if (trip.startedAt) parts.push(`started ${clockTime(trip.startedAt)}`);
  return parts.join(" · ");
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <View style={styles.progress}>
      <Text style={[styles.progressLabel, tabular]}>{done} of {total} delivered</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${total ? (done / total) * 100 : 0}%` }]} />
      </View>
    </View>
  );
}

/** Wave and slot, area, status, progress, cash on this trip and when the rider should be back */
export function TripHeader({ trip, route }: { trip: RiderTrip; route: TripRoute | null }) {
  const cash = tripCash(trip);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titles}>
          <Text style={styles.title}>{waveLabel(trip)}</Text>
          <Text style={styles.sub} numberOfLines={1}>{subtitle(trip)}</Text>
        </View>
        <StatusPill {...TRIP_PHASE[trip.status]} dot={trip.status === "IN_PROGRESS"} />
      </View>
      <Progress done={trip.orders.filter(isDelivered).length} total={trip.orders.length} />
      <View style={styles.facts}>
        {cash > 0 && <Text style={[styles.cash, tabular]}>{formatINR(cash)} to collect</Text>}
        {route && <Text style={[styles.finish, tabular]}>{finishText(route)}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, borderRadius: 16, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  progress: { gap: 6 },
  progressLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  track: { height: 8, borderRadius: 4, backgroundColor: manage.hairline, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cash: { fontFamily: fonts.extrabold, fontSize: 13, color: manage.attentionText, backgroundColor: manage.attentionBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, overflow: "hidden" },
  finish: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, backgroundColor: manage.tint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, overflow: "hidden" },
});
