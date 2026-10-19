import { useCallback, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../../../constants/theme";
import { ManageScreen } from "../ManageScreen";
import { EmptyState } from "../ui/EmptyState";
import { toDateKey } from "../ui/dates";
import { manage } from "../ui/tokens";
import { DayPicker } from "./DayPicker";
import { DaySummaryCard } from "./DaySummaryCard";
import { DoneTrips } from "./DoneTrips";
import { LocationBanner } from "./LocationBanner";
import { RiderActionBar } from "./RiderActionBar";
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

function TripList({ day, handlers }: { day: RiderDay; handlers: StopHandlers }) {
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
        <RiderTripCard key={t.id} trip={t} route={t.id === active?.id ? route : null} handlers={handlers} />
      ))}
      <DoneTrips trips={day.trips.filter((t) => t.status === "COMPLETED")} handlers={handlers} />
    </>
  );
}

function Body({ rider, handlers }: { rider: ReturnType<typeof useRiderDay>; handlers: StopHandlers }) {
  const { day, loading, error, refresh } = rider;
  if (loading) return <ActivityIndicator style={styles.spinner} color={colors.primary} />;
  if (error || !day) return <EmptyState icon="cloud-offline-outline" title="Couldn't load your trips" message={error ?? undefined} action={{ label: "Try again", onPress: refresh }} />;
  const empty = day.trips.length === 0;
  return (
    <>
      {!empty && <DaySummaryCard summary={day.summary} />}
      {empty
        ? <EmptyState icon="bicycle-outline" title="No trips for you today" message="When a manager assigns you a trip it shows up here." />
        : <TripList day={day} handlers={handlers} />}
    </>
  );
}

/** The trip the bar acts on: the one on the road, else the next one waiting to start */
function currentWork(day: RiderDay | null) {
  const trip = day?.trips.find((t) => t.status === "IN_PROGRESS") ?? day?.trips.find((t) => t.status === "CREATED") ?? null;
  const next = trip?.status === "IN_PROGRESS" ? trip.orders.find((s) => s.status === "OUT_FOR_DELIVERY") ?? null : null;
  return { trip, next };
}

/** A rider's Trips tab: the day in a line, the stop to ride to now, what's next and done, and the action pinned in reach */
export function RiderTrips() {
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [overlay, setOverlay] = useState<RiderOverlay | null>(null);
  const [dockHeight, setDockHeight] = useState(0);
  const rider = useRiderDay(date);
  const actions = useRiderActions(rider.reload);
  const tripOf = (stop: { id: string }) => rider.day?.trips.find((t) => t.orders.some((s) => s.id === stop.id))?.id ?? "";
  const handlers = {
    onOpen: (stop: RiderOverlay["stop"]) => setOverlay({ kind: "stop", tripId: tripOf(stop), stop }),
    onFail: (stop: RiderOverlay["stop"]) => setOverlay({ kind: "fail", tripId: tripOf(stop), stop }),
  };
  const { trip, next } = currentWork(rider.day);

  return (
    <View style={styles.root}>
      <ManageScreen
        title="My trips"
        headerSubtitle={rider.day && rider.day.trips.length > 0 ? subtitle(rider.day.trips) : undefined}
        headerRight={<DayPicker value={date} onChange={setDate} />}
        refreshing={rider.refreshing}
        onRefresh={rider.refresh}
        dockHeight={trip ? dockHeight : 0}
      >
        <Body rider={rider} handlers={handlers} />
      </ManageScreen>
      <RiderActionBar
        trip={trip}
        next={next}
        starting={actions.running}
        onStart={actions.start}
        onArrive={(stop) => router.push({ pathname: "/manage/deliver/[orderId]", params: { orderId: stop.id, date } })}
        onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
      />
      <RiderOverlays overlay={overlay} actions={actions} onClose={() => setOverlay(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  spinner: { marginTop: 40 },
});
