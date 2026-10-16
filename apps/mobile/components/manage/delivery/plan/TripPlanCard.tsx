import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { SectionCard } from "../../ui/SectionCard";
import { StatusPill } from "../../ui/StatusPill";
import { manage, tabular } from "../../ui/tokens";
import { etaFor } from "../../rider/format";
import { useTripRoute } from "../../rider/use-trip-route";
import { LiveTripMap } from "./LiveTripMap";
import { StopRow } from "./StopRow";
import { TripFooter } from "./TripFooter";
import { TripRiderRow } from "./TripRiderRow";
import { TRIP_PHASE, deliveredCount, isUnstarted, tripStats } from "./format";
import type { PlanActions } from "./use-plan-actions";
import type { PlanRider, PlanStop, PlanTrip } from "./types";

export interface TripHandlers {
  actions: PlanActions;
  canDispatch: boolean;
  riders: PlanRider[];
  onPickRider: (trip: PlanTrip) => void;
  onMove: (trip: PlanTrip, stop: PlanStop) => void;
  onFail: (trip: PlanTrip, stop: PlanStop) => void;
  onOpenStop: (stop: PlanStop, tripId: string | null) => void;
}

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <View style={styles.progress}>
      <Text style={[styles.progressLabel, tabular]}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${total ? (done / total) * 100 : 0}%` }]} />
      </View>
    </View>
  );
}

/** One trip in a wave: area, size, packing or delivery progress, rider, stops and the actions that fit its stage */
export function TripPlanCard({ trip, handlers }: { trip: PlanTrip; handlers: TripHandlers }) {
  const { canDispatch, riders } = handlers;
  const unstarted = isUnstarted(trip);
  const editable = canDispatch && unstarted;
  const failable = canDispatch && trip.status === "IN_PROGRESS";
  const suggested = riders.find((r) => r.id === trip.suggestedRiderId) ?? null;
  const onRoad = trip.status === "IN_PROGRESS";
  // ETAs follow the rider: a new position or a finished stop asks for a fresh route
  const { route } = useTripRoute(onRoad ? trip.id : null, `${deliveredCount(trip)}:${trip.live?.updatedAt ?? ""}`);
  const next = onRoad ? trip.stops.find((s) => s.status === "OUT_FOR_DELIVERY") : undefined;
  const [mapOpen, setMapOpen] = useState(false);
  const progress = unstarted
    ? { done: trip.packed, label: `${trip.packed}/${trip.stops.length} packed` }
    : { done: deliveredCount(trip), label: `${deliveredCount(trip)}/${trip.stops.length} delivered` };
  return (
    <SectionCard flush>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.area} numberOfLines={1}>{trip.areaLabel ?? "Trip"}</Text>
          <Text style={[styles.stats, tabular]}>{tripStats(trip)}</Text>
        </View>
        <StatusPill {...TRIP_PHASE[trip.status]} dot={trip.status === "IN_PROGRESS"} />
      </View>
      {trip.status !== "COMPLETED" && <Progress done={progress.done} total={trip.stops.length} label={progress.label} />}
      <TripRiderRow trip={trip} suggested={suggested} onChange={editable ? () => handlers.onPickRider(trip) : undefined}
        onMap={onRoad ? () => setMapOpen(true) : undefined} />
      {trip.stops.map((stop, i) => (
        <StopRow key={stop.id} stop={stop} index={i} onPress={() => handlers.onOpenStop(stop, trip.id)} onMove={editable ? () => handlers.onMove(trip, stop) : undefined}
          onFail={failable && stop.status === "OUT_FOR_DELIVERY" ? () => handlers.onFail(trip, stop) : undefined}
          current={stop === next} etaSeconds={onRoad ? etaFor(route, stop.id) : null} />
      ))}
      {editable && <TripFooter trip={trip} suggested={suggested} actions={handlers.actions} />}
      <LiveTripMap trip={mapOpen ? trip : null} route={route} onClose={() => setMapOpen(false)} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  headText: { flex: 1 },
  area: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  stats: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  progress: { paddingHorizontal: 14, paddingBottom: 6, gap: 6 },
  progressLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  track: { height: 5, borderRadius: 3, backgroundColor: manage.hairline, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
});
