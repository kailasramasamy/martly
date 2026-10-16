import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { manage, tabular } from "../ui/tokens";
import { DeliveredStopLine, FailedStopLine } from "./StopLine";
import { clockTime, waveLabel } from "./format";
import type { StopHandlers } from "./RiderTripCard";
import type { RiderTrip } from "./types";

function summary(trip: RiderTrip): string {
  const parts = [`${trip.orders.length} delivered`];
  if (trip.failures.length > 0) parts.push(`${trip.failures.length} not delivered`);
  if (trip.completedAt) parts.push(`done ${clockTime(trip.completedAt)}`);
  return parts.join(" · ");
}

function DoneTrip({ trip, handlers }: { trip: RiderTrip; handlers: StopHandlers }) {
  const [open, setOpen] = useState(false);
  return (
    <SectionCard flush>
      <TouchableOpacity style={styles.row} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={`${waveLabel(trip)}, done`}>
        <Ionicons name="checkmark-circle" size={22} color="#15803d" />
        <View style={styles.body}>
          <Text style={styles.title}>{waveLabel(trip)}</Text>
          <Text style={[styles.sub, tabular]}>{summary(trip)}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={manage.muted} />
      </TouchableOpacity>
      {open && trip.orders.map((s) => <DeliveredStopLine key={s.id} stop={s} onPress={() => handlers.onOpen(s)} />)}
      {open && trip.failures.map((f) => <FailedStopLine key={f.orderId} failure={f} />)}
    </SectionCard>
  );
}

/** Finished trips, folded to one row each */
export function DoneTrips({ trips, handlers }: { trips: RiderTrip[]; handlers: StopHandlers }) {
  if (trips.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.heading}>Done <Text style={tabular}>{trips.length}</Text></Text>
      {trips.map((t) => <DoneTrip key={t.id} trip={t} handlers={handlers} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  heading: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  body: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
