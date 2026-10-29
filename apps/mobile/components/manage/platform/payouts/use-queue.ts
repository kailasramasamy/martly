import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import type { PaidDetails } from "./QueueSheets";
import type { QueueRow } from "./types";

export type Status = "APPROVED" | "DRAFT";

const BASE = "/api/v1/ledger/platform/settlements";

/** The payout queue for one status: its rows, the selection, and the approve / paid / failed calls */
export function useQueue() {
  const [status, setStatus] = useState<Status>("APPROVED");
  const { data, loading, error, reload } = useResource<QueueRow[]>(`${BASE}?status=${status}`);
  const { run, running } = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);
  const [failing, setFailing] = useState<QueueRow | null>(null);
  const items = data ?? [];

  useEffect(() => setSelected([]), [status, data]);

  const act = async (call: () => Promise<unknown>, done: string) => {
    if (await run(call, done)) reload();
  };

  return {
    status, setStatus, items, loading, error, reload, running, selected, paying, setPaying, failing, setFailing,
    toggle: (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    single: selected.length === 1 ? items.find((r) => r.id === selected[0]) ?? null : null,
    approve: () => act(() => api.post(`${BASE}/approve`, { ids: selected }), "Approved"),
    markPaid: async (d: PaidDetails) => {
      await act(() => api.post(`${BASE}/mark-paid`, { ids: selected, ...d }), "Marked paid");
      setPaying(false);
    },
    markFailed: async (reason: string) => {
      if (!failing) return;
      await act(() => api.post(`${BASE}/${failing.id}/fail`, { reason }), "Marked failed");
      setFailing(null);
    },
  };
}
