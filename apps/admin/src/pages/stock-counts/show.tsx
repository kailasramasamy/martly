import { useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Show } from "@refinedev/antd";
import { Card, Spin } from "antd";
import { useParams } from "react-router";
import { Permission } from "@martly/shared/constants";
import { hasPermission } from "@martly/shared/permissions";

import { CountItemsTable, type CountItem } from "./count-items-table";
import { RecountModal } from "./recount-modal";
import { CorrectLineModal } from "./correct-line-modal";
import { CountInfoCard } from "./count-info-card";
import { CountHeaderButtons } from "./count-header-buttons";
import { RejectModal } from "./reject-modal";
import { useCountActions, useCountData } from "./use-count-actions";
import { ReadableSection } from "../../components/ReadableSection";

export const StockCountShow = () => {
  const { id } = useParams();
  const { data: identity } = useGetIdentity<{ role: string; permissions?: string[] }>();
  const canApprove = identity?.role === "SUPER_ADMIN" || hasPermission(identity?.permissions, Permission.STOCK_APPROVE);
  const data = useCountData(id);
  const actions = useCountActions(id, data.draft, data.load);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [recountOpen, setRecountOpen] = useState(false);
  const [correcting, setCorrecting] = useState<CountItem | null>(null);

  const { count, draft, selectedIds } = data;
  if (!count) return <Spin style={{ display: "block", margin: 80 }} />;

  const isDraft = count.status === "DRAFT";
  const isRecount = count.status === "RECOUNT";
  // An approver never enters a recount; they wait for the counter's numbers
  const entry = isDraft || (isRecount && !canApprove);
  const reviewing = count.status === "SUBMITTED" && canApprove;
  const restCount = count.items.filter((i) => i.countedQty !== null && !i.applied && !selectedIds.includes(i.storeProductId)).length;
  const counted = Object.values(draft).filter((q) => q !== null && q !== undefined).length;

  return (
    <Show
      title={`Stock count — ${count.subcategory.name}`}
      isLoading={actions.busy}
      headerButtons={
        <CountHeaderButtons
          entry={entry} isRecount={isRecount} isDraft={isDraft} reviewing={reviewing}
          counted={counted} total={count.items.length} selectedCount={selectedIds.length}
          onDiscard={actions.discard} onSave={actions.save} onSubmit={actions.submit}
          onRecount={() => setRecountOpen(true)} onReject={() => setRejectOpen(true)} onApprove={() => actions.review("approve")}
        />
      }
    >
      <ReadableSection>
        <CountInfoCard count={count} counterView={entry} />
        <Card title={entry ? `Count each item on the shelf (${counted}/${count.items.length})` : "Items"}>
          <CountItemsTable count={count} draft={draft} entry={entry}
            selectedIds={reviewing ? selectedIds : undefined} onSelect={reviewing ? data.setSelectedIds : undefined}
            onCorrect={reviewing ? setCorrecting : undefined} onChange={(spId, qty) => data.setDraft((d) => ({ ...d, [spId]: qty }))} />
        </Card>
        <RecountModal countId={count.id} open={recountOpen} selectedIds={selectedIds} restCount={restCount}
          onClose={() => setRecountOpen(false)} onDone={(detail) => { setRecountOpen(false); data.applyDetail(detail); }} />
        <CorrectLineModal countId={count.id} item={correcting}
          onClose={() => setCorrecting(null)} onDone={(detail) => { setCorrecting(null); data.applyDetail(detail); }} />
        <RejectModal open={rejectOpen} busy={actions.busy} onClose={() => setRejectOpen(false)} onReject={(note) => actions.review("reject", note)} />
      </ReadableSection>
    </Show>
  );
};
