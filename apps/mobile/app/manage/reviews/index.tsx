import { useState } from "react";
import { useManageScope } from "../../../lib/manage-scope-context";
import { api } from "../../../lib/api";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useAction } from "../../../lib/manage/use-action";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { StickyActionBar } from "../../../components/manage/ui/StickyActionBar";
import { Button } from "../../../components/manage/ui/Button";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { ReviewCard } from "../../../components/manage/reviews/ReviewCard";
import { ReplySheet } from "../../../components/manage/reviews/ReplySheet";
import type { ModerationReview, ReviewStatus } from "../../../components/manage/reviews/types";

const TABS = [
  { value: "PENDING" as const, label: "Pending" },
  { value: "APPROVED" as const, label: "Approved" },
  { value: "REJECTED" as const, label: "Rejected" },
];

type Decision = "APPROVED" | "REJECTED";

function ReviewModeration() {
  const { storeId } = useManageScope();
  const { run, running } = useAction();
  const [status, setStatus] = useState<ReviewStatus>("PENDING");
  const [selected, setSelected] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replying, setReplying] = useState<ModerationReview | null>(null);
  const list = usePagedList<ModerationReview>("/api/v1/reviews/moderation", { status, storeId });
  const selecting = selected.length > 0;

  const changeTab = (next: ReviewStatus) => {
    setSelected([]);
    setStatus(next);
  };

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const decide = async (id: string, decision: Decision) => {
    setBusyId(id);
    await run(() => api.patch(`/api/v1/reviews/${id}/status`, { status: decision }), decision === "APPROVED" ? "Review approved" : "Review rejected");
    setBusyId(null);
    list.refresh();
  };

  const decideBulk = async (decision: Decision) => {
    const done = await run(async () => {
      for (const id of selected) await api.patch(`/api/v1/reviews/${id}/status`, { status: decision });
    }, `${selected.length} review(s) ${decision === "APPROVED" ? "approved" : "rejected"}`);
    if (done === undefined) return;
    setSelected([]);
    list.refresh();
  };

  const deleteReply = async (id: string) => {
    await run(() => api.delete(`/api/v1/reviews/${id}/reply`), "Reply deleted");
    list.refresh();
  };

  return (
    <>
      <ManageListScreen
        title={selecting ? `${selected.length} selected` : "Reviews"}
        list={list}
        filters={<SegmentedTabs options={TABS} value={status} onChange={changeTab} />}
        empty={{ icon: "star-outline", title: `No ${status.toLowerCase()} reviews`, message: "Long-press a review to select several at once." }}
        renderItem={(r) => (
          <ReviewCard
            review={r}
            selected={selected.includes(r.id)}
            selecting={selecting}
            busy={busyId === r.id}
            onToggle={() => toggle(r.id)}
            onStatus={(d) => decide(r.id, d)}
            onReply={() => setReplying(r)}
            onDeleteReply={() => deleteReply(r.id)}
          />
        )}
        footer={selecting ? (
          <StickyActionBar>
            <Button label="Reject" icon="close" variant="danger" loading={running} onPress={() => decideBulk("REJECTED")} style={{ flex: 1 }} />
            <Button label="Approve" icon="checkmark" loading={running} onPress={() => decideBulk("APPROVED")} style={{ flex: 1 }} />
          </StickyActionBar>
        ) : undefined}
      />
      <ReplySheet
        reviewId={replying?.id ?? null}
        initialBody={replying?.reply?.body ?? ""}
        onClose={() => setReplying(null)}
        onSaved={list.refresh}
      />
    </>
  );
}

export default function ReviewsScreen() {
  return <AccessGate resource="reviews"><ReviewModeration /></AccessGate>;
}
