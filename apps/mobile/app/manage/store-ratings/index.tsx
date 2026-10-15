import { useEffect, useState } from "react";
import { useManageScope } from "../../../lib/manage-scope-context";
import { api } from "../../../lib/api";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { StoreRatingRow } from "../../../components/manage/reviews/StoreRatingRow";
import { StoreRatingSummaryTiles } from "../../../components/manage/reviews/StoreRatingSummaryTiles";
import type { StoreRatingRecord, StoreRatingSummary } from "../../../components/manage/reviews/types";

function useSummary(storeId: string | null): StoreRatingSummary | null {
  const [summary, setSummary] = useState<StoreRatingSummary | null>(null);
  useEffect(() => {
    let live = true;
    setSummary(null);
    if (storeId) {
      api.get<StoreRatingSummary>(`/api/v1/store-ratings/store/${storeId}/summary`)
        .then((res) => live && setSummary(res.data))
        .catch(() => live && setSummary(null));
    }
    return () => { live = false; };
  }, [storeId]);
  return summary;
}

function StoreRatingList() {
  const { storeId } = useManageScope();
  const summary = useSummary(storeId);
  const list = usePagedList<StoreRatingRecord>("/api/v1/store-ratings/admin", { storeId });

  return (
    <ManageListScreen
      title="Store ratings"
      list={list}
      filters={summary ? <StoreRatingSummaryTiles summary={summary} /> : undefined}
      empty={{ icon: "ribbon-outline", title: "No ratings yet", message: "Ratings appear after customers rate a delivered order." }}
      renderItem={(r) => <StoreRatingRow rating={r} />}
    />
  );
}

export default function StoreRatingsScreen() {
  return <AccessGate resource="store-ratings"><StoreRatingList /></AccessGate>;
}
