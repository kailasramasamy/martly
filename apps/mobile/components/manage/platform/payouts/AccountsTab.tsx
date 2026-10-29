import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import type { PendingAccount } from "./types";

type Row = Omit<PendingAccount, "id">;

const bankLine = (a: Row) => (a.accountLast4 ? `A/c ••••${a.accountLast4}${a.ifsc ? ` · ${a.ifsc}` : ""}` : null);

const dateOf = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function AccountsTab({ tabs }: { tabs: ReactNode }) {
  const { data, loading, error, reload } = useResource<Row[]>("/api/v1/ledger/platform/payout-accounts?pending=true");
  const { run, running } = useAction();
  const [verifying, setVerifying] = useState<PendingAccount | null>(null);
  const items = useMemo(() => (data ?? []).map((a) => ({ ...a, id: a.organizationId })), [data]);
  const list = { items, loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined };

  const verify = async () => {
    if (!verifying) return;
    const done = await run(() => api.post(`/api/v1/ledger/platform/payout-accounts/${verifying.organizationId}/verify`, {}), "Payout account verified");
    setVerifying(null);
    if (done) reload();
  };

  return (
    <>
      <ManageListScreen
        title="Platform payouts"
        list={list}
        filters={tabs}
        empty={{ icon: "shield-checkmark-outline", title: "All clear", message: "Nothing is waiting for verification." }}
        renderItem={(a) => (
          <ListRow
            title={a.organizationName}
            subtitle={[a.accountHolder, bankLine(a), a.upiVpa].filter(Boolean).join(" · ")}
            caption={`Updated ${dateOf(a.updatedAt)}`}
            chevron
            onPress={() => setVerifying(a)}
          />
        )}
      />
      <ConfirmDialog
        visible={!!verifying}
        title="Verify this payout account?"
        message={verifying ? `${verifying.organizationName}: ${verifying.accountHolder}, ${bankLine(verifying) ?? verifying.upiVpa ?? ""}` : ""}
        confirmLabel="Verify"
        confirmVariant="primary"
        running={running}
        onConfirm={verify}
        onClose={() => setVerifying(null)}
      />
    </>
  );
}
