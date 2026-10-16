import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { NextStopCard } from "./NextStopCard";
import { DeliveredStopLine, FailedStopLine, PendingStopLine, isPacked } from "./StopLine";
import { TripHeader } from "./TripHeader";
import { etaFor, isDelivered } from "./format";
import type { RiderStop, RiderTrip, TripRoute } from "./types";

export interface StopHandlers {
  onOpen: (stop: RiderStop) => void;
  onDeliver: (stop: RiderStop) => void;
  onFail: (stop: RiderStop) => void;
}

interface RiderTripCardProps {
  trip: RiderTrip;
  route: TripRoute | null;
  starting: boolean;
  onStart: () => void;
  handlers: StopHandlers;
}

/** Start is held until the store has packed every order; the trip refreshes live when they do */
function StartTrip({ unpacked, starting, onStart }: { unpacked: number; starting: boolean; onStart: () => void }) {
  return (
    <View style={styles.startWrap}>
      {unpacked > 0 && (
        <View style={styles.waiting}>
          <Ionicons name="time-outline" size={18} color="#1d4ed8" />
          <Text style={styles.waitingText}>Waiting for {unpacked} order{unpacked === 1 ? "" : "s"} to be packed</Text>
        </View>
      )}
      <Button label="Start trip" icon="play" loading={starting} onPress={onStart} disabled={unpacked > 0} style={styles.start} />
    </View>
  );
}

/** An assigned or on-the-road trip: header, start button or next stop, then every stop in order */
export function RiderTripCard({ trip, route, starting, onStart, handlers }: RiderTripCardProps) {
  const next = trip.status === "IN_PROGRESS" ? trip.orders.find((s) => s.status === "OUT_FOR_DELIVERY") : undefined;
  const delivered = trip.orders.filter(isDelivered);
  return (
    <View style={styles.wrap}>
      <TripHeader trip={trip} route={route} />
      {trip.status === "CREATED" && <StartTrip unpacked={trip.orders.filter((s) => !isPacked(s)).length} starting={starting} onStart={onStart} />}
      {next && (
        <NextStopCard
          stop={next}
          position={delivered.length + 1}
          total={trip.orders.length}
          etaSeconds={etaFor(route, next.id)}
          onOpen={() => handlers.onOpen(next)}
          onDeliver={() => handlers.onDeliver(next)}
          onFail={() => handlers.onFail(next)}
        />
      )}
      {/* Every stop in route order, delivered ones included, so the rider sees the whole run */}
      <SectionCard title="All stops" flush>
        {trip.orders.map((s, i) =>
          isDelivered(s)
            ? <DeliveredStopLine key={s.id} stop={s} onPress={() => handlers.onOpen(s)} />
            : <PendingStopLine key={s.id} stop={s} number={i + 1} current={s === next} etaSeconds={etaFor(route, s.id)} onPress={() => handlers.onOpen(s)} />,
        )}
        {trip.failures.map((f) => <FailedStopLine key={f.orderId} failure={f} />)}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  start: { height: 60 },
  startWrap: { gap: 8 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#eff6ff" },
  waitingText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: "#1e40af" },
});
