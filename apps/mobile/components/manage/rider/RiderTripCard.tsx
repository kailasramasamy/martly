import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { NextStopCard } from "./NextStopCard";
import { DeliveredStopLine, FailedStopLine, PendingStopLine } from "./StopLine";
import { TripHeader } from "./TripHeader";
import { etaFor, isDelivered } from "./format";
import type { RiderStop, RiderTrip, TripRoute } from "./types";

export interface StopHandlers {
  onOpen: (stop: RiderStop) => void;
  onFail: (stop: RiderStop) => void;
}

interface RiderTripCardProps {
  trip: RiderTrip;
  route: TripRoute | null;
  handlers: StopHandlers;
}

const UP_NEXT = 2;

function Toggle({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.toggle} onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Text style={styles.toggleText}>{label}</Text>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

/** The stops after this one (the next two, or all on request) and the ones already done, collapsed */
function StopLists({ trip, route, next, handlers }: { trip: RiderTrip; route: TripRoute | null; next: RiderStop | undefined; handlers: StopHandlers }) {
  const [allNext, setAllNext] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const numbered = trip.orders.map((s, i) => ({ stop: s, number: i + 1 }));
  const pending = numbered.filter(({ stop }) => !isDelivered(stop) && stop !== next);
  const done = numbered.filter(({ stop }) => isDelivered(stop));
  const shown = allNext ? pending : pending.slice(0, UP_NEXT);
  const doneCount = done.length + trip.failures.length;
  return (
    <>
      {pending.length > 0 && (
        <SectionCard title={`${next ? "Up next" : "Stops"} · ${pending.length}`} flush>
          {shown.map(({ stop, number }) => <PendingStopLine key={stop.id} stop={stop} number={number} etaSeconds={etaFor(route, stop.id)} onPress={() => handlers.onOpen(stop)} />)}
          {pending.length > UP_NEXT && <Toggle label={allNext ? "Show fewer" : `Show all ${pending.length}`} open={allNext} onPress={() => setAllNext(!allNext)} />}
        </SectionCard>
      )}
      {doneCount > 0 && (
        <SectionCard flush>
          <Toggle label={`Done · ${doneCount}`} open={showDone} onPress={() => setShowDone(!showDone)} />
          {showDone && done.map(({ stop }) => <DeliveredStopLine key={stop.id} stop={stop} onPress={() => handlers.onOpen(stop)} />)}
          {showDone && trip.failures.map((f) => <FailedStopLine key={f.orderId} failure={f} />)}
        </SectionCard>
      )}
    </>
  );
}

/** An assigned or on-the-road trip: header, the stop to ride to now, then what's next and what's done */
export function RiderTripCard({ trip, route, handlers }: RiderTripCardProps) {
  const next = trip.status === "IN_PROGRESS" ? trip.orders.find((s) => s.status === "OUT_FOR_DELIVERY") : undefined;
  return (
    <View style={styles.wrap}>
      <TripHeader trip={trip} route={route} />
      {next && (
        <NextStopCard
          stop={next}
          position={trip.orders.filter(isDelivered).length + 1}
          total={trip.orders.length}
          etaSeconds={etaFor(route, next.id)}
          onOpen={() => handlers.onOpen(next)}
          onFail={() => handlers.onFail(next)}
        />
      )}
      <StopLists trip={trip} route={route} next={next} handlers={handlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 14 },
  toggleText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
});
