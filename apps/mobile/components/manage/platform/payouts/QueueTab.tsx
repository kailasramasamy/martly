import type { ReactNode } from "react";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { Button } from "../../ui/Button";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { StickyActionBar } from "../../ui/StickyActionBar";
import { formatINR } from "../../ui/tokens";
import { SETTLEMENT_PILL } from "../../finance/format";
import { MarkFailedDialog, MarkPaidSheet } from "./QueueSheets";
import { useQueue, type Status } from "./use-queue";
import type { QueueRow } from "./types";

const STATUS_OPTIONS: { value: Status; label: string }[] = [{ value: "APPROVED", label: "Scheduled" }, { value: "DRAFT", label: "Awaiting bank details" }];
const STATUS_LABEL: Record<Status, string> = { APPROVED: "Scheduled", DRAFT: "Awaiting bank details" };

const accountLabel = (a: QueueRow["payoutAccount"]) => (a ? `${a.accountLast4 ? `••${a.accountLast4}` : ""} ${a.upiVpa ?? ""}`.trim() : "No account");
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function QueueTab({ tabs }: { tabs: ReactNode }) {
  const q = useQueue();
  const none = q.selected.length === 0;
  const list = { items: q.items, loading: q.loading, refreshing: false, loadingMore: false, error: q.error, refresh: q.reload, loadMore: () => undefined };

  return (
    <>
      <ManageListScreen
        title="Platform payouts"
        list={list}
        filters={<>{tabs}<SegmentedTabs options={STATUS_OPTIONS} value={q.status} onChange={q.setStatus} /></>}
        empty={{ icon: "cash-outline", title: "No payouts here", message: `Nothing is ${STATUS_LABEL[q.status].toLowerCase()}.` }}
        footer={
          <StickyActionBar>
            {q.status === "DRAFT" ? (
              <Button label="Approve" onPress={q.approve} disabled={none} loading={q.running} style={{ flex: 1 }} />
            ) : (
              <>
                <Button label="Mark failed" variant="danger" onPress={() => q.setFailing(q.single)} disabled={!q.single} style={{ flex: 1 }} />
                <Button label="Mark paid" onPress={() => q.setPaying(true)} disabled={none} style={{ flex: 1 }} />
              </>
            )}
          </StickyActionBar>
        }
        renderItem={(r) => (
          <ListRow
            title={`${r.number} · ${r.organizationName}`}
            subtitle={accountLabel(r.payoutAccount)}
            status={{ label: STATUS_LABEL[q.status], ...SETTLEMENT_PILL[r.status] }}
            caption={dateOf(r.createdAt)}
            value={formatINR(r.net, { decimals: true })}
            selected={q.selected.includes(r.id)}
            onPress={() => q.toggle(r.id)}
          />
        )}
      />
      <MarkPaidSheet visible={q.paying} count={q.selected.length} running={q.running} onSubmit={q.markPaid} onClose={() => q.setPaying(false)} />
      <MarkFailedDialog number={q.failing?.number ?? null} running={q.running} onSubmit={q.markFailed} onClose={() => q.setFailing(null)} />
    </>
  );
}
