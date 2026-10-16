import { ActivityIndicator } from "react-native";
import { colors } from "../../../constants/theme";
import { EmptyState } from "../ui/EmptyState";
import { OrdersSection, ReadySection, TripsSection } from "./BoardSections";
import { outWithoutTrip, pickupsReady, readyToDispatch, stillPreparing } from "./groups";
import { useDispatchAccess } from "./use-dispatch-access";
import type { BoardData, MenuOrder, Trip } from "./types";
import type { DeliveryView } from "./filters";

interface DeliveryBodyProps {
  board: BoardData;
  trips: Trip[];
  /** Which part of the board to show ("" = everything) */
  view?: DeliveryView;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onMenu: (order: MenuOrder) => void;
  onChanged: () => void;
}

/** A rider's own trips: active ones first, then today's completed */
function MyTrips({ trips, onChanged, onMenu }: { trips: Trip[]; onChanged: () => void; onMenu: (order: MenuOrder) => void }) {
  const { userId } = useDispatchAccess();
  const mine = trips.filter((t) => t.rider.id === userId);
  const active = mine.filter((t) => t.status === "CREATED" || t.status === "IN_PROGRESS");
  if (mine.length === 0) return <EmptyState icon="bicycle-outline" title="No trips for you yet" message="Trips assigned to you appear here." />;
  return (
    <>
      <TripsSection title="Your trips" trips={active} onChanged={onChanged} onMenu={onMenu} />
      <TripsSection title="Completed" trips={mine.filter((t) => t.status === "COMPLETED")} onChanged={onChanged} onMenu={onMenu} />
    </>
  );
}

/** The dispatch desk: what's ready to go out, what's on the road, and what's still being packed */
export function DeliveryBody({ board, trips, view = "", selected, onToggle, onMenu, onChanged }: DeliveryBodyProps) {
  const { canDispatch, riderOnly } = useDispatchAccess();
  if (riderOnly) return <MyTrips trips={trips} onChanged={onChanged} onMenu={onMenu} />;

  const ready = readyToDispatch(board);
  const unassignedOut = outWithoutTrip(board);
  const preparing = stillPreparing(board);
  const pickups = pickupsReady(board);
  const byStatus = (status: Trip["status"]) => trips.filter((t) => t.status === status);
  const toggle = canDispatch ? onToggle : undefined;
  const show = (part: DeliveryView) => view === "" || view === part;
  const counts = {
    ready: ready.express.length + ready.scheduled.length,
    road: byStatus("CREATED").length + byStatus("IN_PROGRESS").length + unassignedOut.length,
    pickup: pickups.length,
    preparing: preparing.length,
    done: view === "" ? byStatus("COMPLETED").length : 0,
  };
  const nothing = (["ready", "road", "pickup", "preparing"] as const).every((p) => !show(p) || counts[p] === 0) && counts.done === 0;

  return (
    <>
      {nothing && <EmptyState icon="bicycle-outline" title="Nothing here" message={view ? "No orders match these filters." : "No delivery orders or trips for this day."} />}
      {show("ready") && <ReadySection title="Ready · Express" groups={ready.express} selected={selected} onToggle={toggle} onMenu={onMenu} />}
      {show("ready") && <ReadySection title="Ready · Scheduled" groups={ready.scheduled} selected={selected} onToggle={toggle} onMenu={onMenu} />}
      {show("road") && <TripsSection title="Trips not started" trips={byStatus("CREATED")} onChanged={onChanged} onMenu={onMenu} />}
      {show("road") && <TripsSection title="Out for delivery" trips={byStatus("IN_PROGRESS")} onChanged={onChanged} onMenu={onMenu} />}
      {show("road") && <OrdersSection title="Out for delivery · no rider" orders={unassignedOut} onMenu={onMenu} />}
      {show("pickup") && <OrdersSection title="Ready for pickup · at counter" orders={pickups} onMenu={onMenu} />}
      {show("preparing") && <OrdersSection title="Still preparing" orders={preparing} onMenu={onMenu} />}
      {view === "" && <TripsSection title="Completed trips" trips={byStatus("COMPLETED")} onChanged={onChanged} onMenu={onMenu} />}
    </>
  );
}

interface DeliveryContentProps extends Omit<DeliveryBodyProps, "board"> {
  board: BoardData | null;
  storeId: string | null;
  scopeLoading: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Picks between the store prompt, spinner, error and the board itself */
export function DeliveryContent({ storeId, scopeLoading, loading, error, board, onRetry, ...rest }: DeliveryContentProps) {
  if (!storeId) {
    return scopeLoading
      ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      : <EmptyState icon="storefront-outline" title="Pick a store" message="The delivery board is per store. Choose one from the switcher above." />;
  }
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  if (error || !board) return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error ?? undefined} action={{ label: "Try again", onPress: onRetry }} />;
  return <DeliveryBody board={board} {...rest} />;
}
