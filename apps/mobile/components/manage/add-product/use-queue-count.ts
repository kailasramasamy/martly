import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useRefreshOnFocus } from "../../../lib/manage/use-refresh-on-focus";

/** Drafts still moving through processing or waiting for review, for one store */
export function useQueueCount(storeId: string | null, enabled: boolean): number {
  const on = enabled && !!storeId;
  const params = (status: string) => ({ status, storeId: storeId ?? "" });
  const options = { pageSize: 1, enabled: on };
  const queued = usePagedList("/api/v1/catalog-drafts", params("QUEUED"), options);
  const processing = usePagedList("/api/v1/catalog-drafts", params("PROCESSING"), options);
  const review = usePagedList("/api/v1/catalog-drafts", params("NEEDS_REVIEW"), options);

  useRefreshOnFocus(() => {
    if (!on) return;
    queued.refresh();
    processing.refresh();
    review.refresh();
  });

  return on ? queued.total + processing.total + review.total : 0;
}
