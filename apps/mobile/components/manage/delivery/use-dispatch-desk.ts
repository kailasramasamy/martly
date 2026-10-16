import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useOrderWebSocket } from "../../../lib/useOrderWebSocket";
import { toDateKey } from "../ui/dates";
import { applyDeliveryFilters } from "./filters";
import { useDeliveryBoard } from "./use-delivery-board";
import { useDeliveryFilters } from "./use-delivery-filters";
import { useSelection } from "./use-selection";
import type { MenuOrder } from "./types";

/** All state behind the Delivery tab: the day, board data, filters, selection, open sheets and live refresh */
export function useDispatchDesk() {
  const router = useRouter();
  const { storeId, loading: scopeLoading } = useManageScope();
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [menuOrder, setMenuOrder] = useState<MenuOrder | null>(null);
  const [assigning, setAssigning] = useState(false);
  // Height of the selection bar docked above the tab bar, so the board scrolls clear of it
  const [dockHeight, setDockHeight] = useState(0);
  const selection = useSelection();
  const data = useDeliveryBoard(storeId, date);
  const filters = useDeliveryFilters(data.board, data.trips);
  const filtered = data.board ? applyDeliveryFilters(data.board, data.trips, filters.filters) : null;
  const { reloadQuietly } = data;

  useOrderWebSocket({ onOrdersChanged: useCallback(() => { reloadQuietly(); }, [reloadQuietly]), enabled: !!storeId });

  const changeDate = (key: string) => {
    selection.clear();
    setDate(key);
  };
  const tripCreated = () => {
    setAssigning(false);
    selection.clear();
    reloadQuietly();
  };
  const openRiders = () => {
    setAssigning(false);
    router.push(`/manage/riders${storeId ? `?storeId=${storeId}` : ""}`);
  };

  return {
    storeId, scopeLoading, date, changeDate, data, filters, filtered, selection,
    menuOrder, setMenuOrder, assigning, setAssigning, dockHeight, setDockHeight, tripCreated, openRiders,
  };
}
