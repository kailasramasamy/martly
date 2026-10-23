import { useCallback, useMemo, useState } from "react";
import { useResource } from "../../../../lib/manage/use-resource";
import { toDateKey } from "../../ui/dates";
import type { SegmentOption } from "../../ui/SegmentedTabs";
import type { Campaign } from "../types";
import { campaignsByDay, currentMonth, isShownByDefault, monthKey, type MonthCursor } from "./calendar-data";

export const ALL_TYPES = "ALL";

/** Everything the calendar screen shows: campaigns, filters, the month being viewed and the selected day */
export function useCalendarData() {
  const resource = useResource<Campaign[]>("/api/v1/brand-campaigns");
  const [cursor, setCursor] = useState<MonthCursor>(currentMonth);
  const [selected, setSelected] = useState(() => toDateKey(new Date()));
  const [type, setType] = useState(ALL_TYPES);
  const [showClosed, setShowClosed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const byStatus = useMemo(() => (resource.data ?? []).filter((c) => showClosed || isShownByDefault(c)), [resource.data, showClosed]);
  const campaigns = useMemo(() => byStatus.filter((c) => type === ALL_TYPES || c.product.name === type), [byStatus, type]);
  const typeOptions = useMemo<SegmentOption<string>[]>(() => {
    const names = [...new Set(byStatus.map((c) => c.product.name))].sort();
    return [{ value: ALL_TYPES, label: "All types" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [byStatus]);
  const byDay = useMemo(() => campaignsByDay(campaigns, cursor), [campaigns, cursor]);

  const goTo = useCallback((next: MonthCursor) => {
    const today = new Date();
    const isCurrent = next.y === today.getFullYear() && next.m === today.getMonth();
    setCursor(next);
    setSelected(isCurrent ? toDateKey(today) : monthKey(next, 1));
  }, []);
  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    goTo({ y: d.getFullYear(), m: d.getMonth() });
  };

  const refresh = async () => {
    setRefreshing(true);
    await resource.reload();
    setRefreshing(false);
  };

  return {
    loading: resource.loading, error: resource.error, reload: resource.reload, refreshing, refresh,
    campaigns, byDay, cursor, selected, setSelected, type, setType, typeOptions,
    showClosed, setShowClosed, shift, goToday: () => goTo(currentMonth()),
  };
}
