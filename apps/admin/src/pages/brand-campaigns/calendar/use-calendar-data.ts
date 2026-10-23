import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { axiosInstance } from "../../../providers/data-provider";
import { errorMessage } from "../../marketing/utils";
import { PLATFORM_SCOPE, type Campaign } from "../types";
import { DAY_KEY, campaignsByDay, currentMonth, isShownByDefault } from "./calendar-data";

export const ALL_TYPES = "ALL";

/** Everything the calendar shows: campaigns, filters, the month being viewed and the selected day */
export function useCalendarData() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [month, setMonth] = useState<Dayjs>(currentMonth);
  const [selected, setSelected] = useState(() => dayjs().format(DAY_KEY));
  const [type, setType] = useState(ALL_TYPES);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    axiosInstance.get(PLATFORM_SCOPE.apiBase)
      .then((res) => setRows(res.data.data))
      .catch((err) => setError(errorMessage(err, "Could not load campaigns")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const byStatus = useMemo(() => rows.filter((c) => showClosed || isShownByDefault(c)), [rows, showClosed]);
  const campaigns = useMemo(() => byStatus.filter((c) => type === ALL_TYPES || c.product.name === type), [byStatus, type]);
  const typeNames = useMemo(() => [...new Set(byStatus.map((c) => c.product.name))].sort(), [byStatus]);
  const byDay = useMemo(() => campaignsByDay(campaigns, month), [campaigns, month]);

  const goTo = useCallback((next: Dayjs) => {
    setMonth(next);
    setSelected(next.isSame(dayjs(), "month") ? dayjs().format(DAY_KEY) : next.format(DAY_KEY));
  }, []);

  return {
    loading, error, reload: load, campaigns, byDay, month, selected, setSelected, type, setType, typeNames,
    showClosed, setShowClosed, shift: (delta: number) => goTo(month.add(delta, "month")), goToday: () => goTo(currentMonth()),
  };
}
