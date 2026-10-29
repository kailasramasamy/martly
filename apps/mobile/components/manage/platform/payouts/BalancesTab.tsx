import { useMemo } from "react";
import type { ReactNode } from "react";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { formatINR } from "../../ui/tokens";
import { TONES } from "../../marketing/common";
import type { AccountState, Balance } from "./types";

const ACCOUNT_STATUS: Record<AccountState, { label: string; color: string; bg: string }> = {
  VERIFIED: { label: "Verified", ...TONES.green },
  PENDING: { label: "Awaiting verification", ...TONES.amber },
  MISSING: { label: "No payout account", ...TONES.red },
};

export function BalancesTab({ tabs }: { tabs: ReactNode }) {
  const { data, loading, error, reload } = useResource<Omit<Balance, "id">[]>("/api/v1/ledger/platform/balances");
  const items = useMemo(() => (data ?? []).map((b) => ({ ...b, id: b.organizationId })), [data]);
  const list = { items, loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined };

  return (
    <ManageListScreen
      title="Platform payouts"
      list={list}
      filters={tabs}
      empty={{ icon: "swap-horizontal-outline", title: "No organizations yet" }}
      renderItem={(b) => (
        <ListRow
          title={b.name}
          subtitle={`Available ${formatINR(b.available)} · On hold ${formatINR(b.onHold)}`}
          caption={`Carried ${formatINR(b.carried)} · Scheduled ${formatINR(b.scheduled)} · Due ${formatINR(b.due)}`}
          status={ACCOUNT_STATUS[b.payoutAccount]}
          value={formatINR(b.balance)}
        />
      )}
    />
  );
}
