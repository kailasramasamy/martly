import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../../../constants/theme";
import { ManageScreen } from "../ManageScreen";
import { DateBar } from "../delivery/DateBar";
import { EmptyState } from "../ui/EmptyState";
import { toDateKey } from "../ui/dates";
import { manage } from "../ui/tokens";
import { DaySummaryCard } from "./DaySummaryCard";
import { DoneTrips } from "./DoneTrips";
import { LocationBanner } from "./LocationBanner";
import { RiderOverlays } from "./RiderOverlays";
import { RiderTripCard, type StopHandlers } from "./RiderTripCard";
import { isDelivered } from "./format";
import { useRiderActions } from "./use-rider-actions";
import { useRiderDay } from "./use-rider-day";
import { useShareLocation } from "./use-share-location";
import { useTripRoute } from "./use-trip-route";
import type { RiderDay, RiderOverlay, RiderTrip } from "./types";

const ROUTE_REFRESH_MS = 30000;

function subtitle(trips: RiderTrip[]): string {
  const left = trips.reduce((sum, t) => sum + t.orders.filter((s) => !isDelivered(s)).length, 0);
  return `${trips.length} trip${trips.length === 1 ? "" : "s"} · ${left} stop${left === 1 ? "" : "s"} left`;
}

function TripList({ day, handlers, actions }: { day: RiderDay; handlers: StopHandlers; actions: ReturnType<typeof useRiderActions> }) {
  const active = day.trips.find((t) => t.status === "IN_PROGRESS") ?? null;
  const signature = active ? active.orders.map((s) => s.id + s.status).join() : "";
  const { route, reload: reloadRoute } = useTripRoute(active?.id ?? null, signature);
  const lastRefresh = useRef(0);
  const onSent = useCallback(() => {
    if (Date.now() - lastRefresh.current < ROUTE_REFRESH_MS) return;
    lastRefresh.current = Date.now();
    reloadRoute();
  }, [reloadRoute]);
  const location = useShareLocation(active?.id ?? null, onSent);
  const open = day.trips.filter((t) => t.status !== "COMPLETED").sort((a, b) => Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS"));

  return (
    <>
      {location.access !== "granted" && <LocationBanner access={location.access} onRetry={location.retry} />}
      {open.map((t) => (
        <RiderTripCard key={t.id} trip={t} route={t.id === active?.id ? route : null} starting={actions.running} onStart={() => actions.start(t.id)} handlers={handlers} />
      ))}
      <DoneTrips trips={day.trips.filter((t) => t.status === "COMPLETED")} handlers={handlers} />
    </>
  );
}

function Body({ rider, handlers, actions }: { rider: ReturnType<typeof useRiderDay>; handlers: StopHandlers; actions: ReturnType<typeof useRiderActions> }) {
  const { day, loading, error, refresh } = rider;
  if (loading) return <ActivityIndicator style={styles.spinner} color={colors.primary} />;
  if (error || !day) return <EmptyState icon="cloud-offline-outline" title="Couldn't load your trips" message={error ?? undefined} action={{ label: "Try again", onPress: refresh }} />;
  const empty = day.trips.length === 0;
  return (
    <>
      {!empty && <DaySummaryCard summary={day.summary} />}
      {empty
        ? <EmptyState icon="bicycle-outline" title="No trips for you today" message="When a manager assigns you a trip it shows up here." />
        : <TripList day={day} handlers={handlers} actions={actions} />}
    </>
  );
}

/** A rider's Trips tab: the day's numbers, the trip on the road with its next stop, then what's assigned and done */
export function RiderTrips() {
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [overlay, setOverlay] = useState<RiderOverlay | null>(null);
  const rider = useRiderDay(date);
  const actions = useRiderActions(rider.reload);
  const tripOf = (stop: { id: string }) => rider.day?.trips.find((t) => t.orders.some((s) => s.id === stop.id))?.id ?? "";
  const handlers = {
    onOpen: (stop: RiderOverlay["stop"]) => setOverlay({ kind: "stop", tripId: tripOf(stop), stop }),
    onDeliver: (stop: RiderOverlay["stop"]) => setOverlay({ kind: "deliver", tripId: tripOf(stop), stop }),
    onFail: (stop: RiderOverlay["stop"]) => setOverlay({ kind: "fail", tripId: tripOf(stop), stop }),
  };

  return (
    <View style={styles.root}>
      <ManageScreen title="My trips" headerSubtitle={rider.day && rider.day.trips.length > 0 ? subtitle(rider.day.trips) : undefined} refreshing={rider.refreshing} onRefresh={rider.refresh}>
        <DateBar value={date} onChange={setDate} />
        <Body rider={rider} handlers={handlers} actions={actions} />
      </ManageScreen>
      <RiderOverlays overlay={overlay} actions={actions} onClose={() => setOverlay(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  spinner: { marginTop: 40 },
});
