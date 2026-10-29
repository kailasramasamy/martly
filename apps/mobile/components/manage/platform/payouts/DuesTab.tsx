import { useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { formatINR } from "../../ui/tokens";
import { TONES } from "../../marketing/common";
import { DueSheet } from "./DueSheet";
import type { Due } from "./types";

const STATUS: Record<Due["status"], { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", ...TONES.amber },
  PAID: { label: "Paid", ...TONES.green },
  CANCELLED: { label: "Cancelled", ...TONES.slate },
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const captionOf = (d: Due) => {
  const reference = d.offlineReference ?? d.razorpayPaymentId;
  return [`Raised ${day(d.createdAt)}`, d.paidAt ? `Paid ${day(d.paidAt)}` : null, reference].filter(Boolean).join(" · ");
};

export function DuesTab({ tabs }: { tabs: ReactNode }) {
  const { data, loading, error, reload } = useResource<Due[]>("/api/v1/ledger/platform/dues");
  const { run, running } = useAction();
  const [acting, setActing] = useState<Due | null>(null);
  const list = { items: data ?? [], loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined };

  const act = async (path: string, body: object, done: string) => {
    if (!acting) return;
    const ok = await run(() => api.post(`/api/v1/ledger/platform/dues/${acting.id}/${path}`, body), done);
    setActing(null);
    if (ok) reload();
  };

  return (
    <>
      <ManageListScreen
        title="Platform payouts"
        list={list}
        filters={tabs}
        empty={{ icon: "receipt-outline", title: "No dues", message: "Balances stores owe Martly show up here." }}
        renderItem={(d) => (
          <ListRow
            title={d.organizationName}
            status={STATUS[d.status]}
            caption={captionOf(d)}
            value={formatINR(d.amount, { decimals: true })}
            chevron={d.status === "PENDING"}
            onPress={d.status === "PENDING" ? () => setActing(d) : undefined}
          />
        )}
      />
      <DueSheet
        due={acting}
        running={running}
        onMarkPaid={(reference) => act("mark-paid", { reference }, "Due marked paid")}
        onCancelDue={() => act("cancel", {}, "Due cancelled")}
        onClose={() => setActing(null)}
      />
    </>
  );
}
