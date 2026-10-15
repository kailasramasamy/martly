import { ActivityIndicator } from "react-native";
import { colors } from "../../../constants/theme";
import { EmptyState } from "../ui/EmptyState";
import { KitchenSection, ReadySection, TripsSection } from "./BoardSections";
import { inKitchen, readyToDispatch } from "./groups";
import type { BoardData, BoardOrder, Trip } from "./types";

interface DeliveryBodyProps {
  board: BoardData;
  trips: Trip[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onMenu: (order: BoardOrder) => void;
  onChanged: () => void;
}

export function DeliveryBody({ board, trips, selected, onToggle, onMenu, onChanged }: DeliveryBodyProps) {
  const ready = readyToDispatch(board);
  const kitchen = inKitchen(board);
  const byStatus = (status: Trip["status"]) => trips.filter((t) => t.status === status);
  const nothing = ready.express.length + ready.scheduled.length + kitchen.length + trips.length === 0;

  return (
    <>
      {nothing && <EmptyState icon="bicycle-outline" title="Nothing to dispatch" message="No delivery orders or trips for this day." />}
      <ReadySection title="Ready · Express" groups={ready.express} selected={selected} onToggle={onToggle} onMenu={onMenu} />
      <ReadySection title="Ready · Scheduled" groups={ready.scheduled} selected={selected} onToggle={onToggle} onMenu={onMenu} />
      <TripsSection title="In progress · not started" trips={byStatus("CREATED")} onChanged={onChanged} />
      <TripsSection title="Out for delivery" trips={byStatus("IN_PROGRESS")} onChanged={onChanged} />
      <KitchenSection orders={kitchen} onMenu={onMenu} />
      <TripsSection title="Completed trips" trips={byStatus("COMPLETED")} onChanged={onChanged} />
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
