import type { CatalogDraftDetail } from "@martly/shared/types";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";

/** Retry and discard share the "POST, get the fresh draft back" shape */
export function useDraftActions(id: string, onDone: (next: CatalogDraftDetail) => void) {
  const { run, running } = useAction();

  const post = async (verb: "retry" | "discard", message: string) => {
    const next = await run(() => api.post<CatalogDraftDetail>(`/api/v1/catalog-drafts/${id}/${verb}`, {}).then((r) => r.data), message);
    if (next) onDone(next);
  };

  return {
    running,
    retry: () => post("retry", "Back in the queue"),
    discard: () => post("discard", "Discarded"),
  };
}
