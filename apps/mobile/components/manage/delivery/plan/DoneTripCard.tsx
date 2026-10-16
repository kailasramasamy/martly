import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { SectionCard } from "../../ui/SectionCard";
import { StatusPill } from "../../ui/StatusPill";
import { formatINR, manage, tabular } from "../../ui/tokens";
import { clockTime, minutesText } from "../../rider/format";
import { StopRow } from "./StopRow";
import { TRIP_PHASE, deliveredCount } from "./format";
import type { PlanStop, PlanTrip } from "./types";

function timesText(trip: PlanTrip): string | null {
  if (!trip.startedAt || !trip.completedAt) return null;
  const took = (new Date(trip.completedAt).getTime() - new Date(trip.startedAt).getTime()) / 1000;
  return `${clockTime(trip.startedAt)} → ${clockTime(trip.completedAt)} · ${minutesText(took).replace("~", "")}`;
}

/** Cash the rider should have handed over, and UPI that went straight to the store */
function moneyText(trip: PlanTrip): string | null {
  const sum = (via: "CASH" | "UPI") => trip.stops.filter((s) => s.codCollectedVia === via).reduce((n, s) => n + s.amountCollected, 0);
  const parts = [["cash", sum("CASH")], ["UPI", sum("UPI")]].filter(([, v]) => (v as number) > 0).map(([k, v]) => `${formatINR(v as number)} ${k}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** A finished trip at a glance: who, when, how long, what was delivered and collected; stops on demand */
export function DoneTripCard({ trip, onOpenStop }: { trip: PlanTrip; onOpenStop: (stop: PlanStop) => void }) {
  const [open, setOpen] = useState(false);
  const times = timesText(trip);
  const money = moneyText(trip);
  const delivered = deliveredCount(trip);
  return (
    <SectionCard flush>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.area} numberOfLines={1}>{trip.areaLabel ?? "Trip"}</Text>
          <Text style={styles.rider} numberOfLines={1}>{trip.rider?.name ?? "No rider"}</Text>
        </View>
        <StatusPill {...TRIP_PHASE.COMPLETED} />
      </View>
      <View style={styles.facts}>
        {times && <Fact icon="time-outline" text={times} />}
        <Fact icon="checkmark-done" text={`${delivered} of ${trip.stops.length} delivered`} />
        {money && <Fact icon="wallet-outline" text={money} />}
      </View>
      <TouchableOpacity style={styles.toggle} onPress={() => setOpen((v) => !v)} accessibilityRole="button">
        <Text style={styles.toggleText}>{open ? "Hide stops" : "Show stops"}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
      </TouchableOpacity>
      {open && trip.stops.map((s, i) => <StopRow key={s.id} stop={s} index={i} onPress={() => onOpenStop(s)} />)}
    </SectionCard>
  );
}

function Fact({ icon, text }: { icon: "time-outline" | "checkmark-done" | "wallet-outline"; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={15} color={manage.muted} />
      <Text style={[styles.factText, tabular]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 14 },
  headText: { flex: 1 },
  area: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  rider: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  facts: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 6 },
  fact: { flexDirection: "row", alignItems: "center", gap: 8 },
  factText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 14 },
  toggleText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
