import { useState } from "react";
import { useRouter } from "expo-router";
import { LedgerEntryTypeLabels } from "@martly/shared/constants";
import { useResource } from "../../../lib/manage/use-resource";
import { useAuth } from "../../../lib/auth-context";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { formatDate } from "../ui/dates";
import { amountColor, entryPill, signedINR } from "./format";
import { QuerySheet } from "./QuerySheet";
import type { LedgerEntry } from "../../../lib/ledger-types";

function Links({ entry, owner }: { entry: LedgerEntry; owner: boolean }) {
  const router = useRouter();
  if (!entry.orderId && !entry.returnRequestId && !(owner && entry.settlementId)) return null;
  return (
    <SectionCard flush>
      {entry.orderId ? <ListRow title="View order" subtitle={entry.orderRef ?? undefined} icon="receipt-outline" chevron onPress={() => router.push(`/manage/orders/${entry.orderId}`)} /> : null}
      {entry.returnRequestId ? <ListRow title="View return request" icon="return-down-back-outline" chevron onPress={() => router.push(`/manage/return-requests/${entry.returnRequestId}`)} /> : null}
      {owner && entry.settlementId ? <ListRow title="View payout" subtitle={entry.settlementNumber ?? undefined} icon="cash-outline" chevron onPress={() => router.push(`/manage/finance/settlements/${entry.settlementId}`)} /> : null}
    </SectionCard>
  );
}

export function EntryDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [asking, setAsking] = useState(false);
  const { data: e, loading, error, reload } = useResource<LedgerEntry>(`/api/v1/ledger/entries/${id}`);
  const owner = user?.role === "ORG_ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <ManageStackScreen
      title="Entry"
      loading={loading}
      error={error}
      onRetry={reload}
      actions={e ? <Button label="Raise a query" icon="help-circle-outline" variant="secondary" onPress={() => setAsking(true)} style={{ flex: 1 }} /> : undefined}
    >
      {e && (
        <>
          <SectionCard title="Breakdown">
            <StatusPill {...entryPill(e)} />
            <KeyValue label="Type" value={LedgerEntryTypeLabels[e.type]} />
            {e.memo ? <KeyValue label="Note" value={e.memo} /> : null}
            <KeyValue label="Store" value={e.storeName} />
            <KeyValue label="Date" value={formatDate(e.createdAt, true)} />
            {e.availableAt ? <KeyValue label="Available from" value={formatDate(e.availableAt)} /> : null}
            <KeyValue label="Amount" value={signedINR(e.amount, { decimals: true })} valueColor={amountColor(e.amount)} emphasis />
          </SectionCard>
          <Links entry={e} owner={owner} />
          <QuerySheet entryId={e.id} visible={asking} onClose={() => setAsking(false)} />
        </>
      )}
    </ManageStackScreen>
  );
}
