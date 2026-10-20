import { Linking } from "react-native";
import { LedgerEntryTypeLabels, SettlementStatusLabels } from "@martly/shared/constants";
import { getApiUrl } from "../../../lib/api";
import { useResource } from "../../../lib/manage/use-resource";
import { useToast } from "../../../lib/toast-context";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { formatDate } from "../ui/dates";
import { formatINR } from "../ui/tokens";
import { SETTLEMENT_PILL, amountColor, shortDate, signedINR } from "./format";
import type { SettlementDetail } from "../../../lib/ledger-types";

function Totals({ s }: { s: SettlementDetail }) {
  return (
    <SectionCard title="Summary">
      <StatusPill label={SettlementStatusLabels[s.status]} {...SETTLEMENT_PILL[s.status]} />
      <KeyValue label="Period" value={`${shortDate(s.periodStart)} – ${shortDate(s.periodEnd)}`} />
      <KeyValue label="Credits" value={formatINR(s.credits, { decimals: true })} />
      <KeyValue label="Debits" value={signedINR(-Math.abs(Number(s.debits)), { decimals: true })} />
      {Number(s.carriedIn) !== 0 ? <KeyValue label="Carried in" value={signedINR(s.carriedIn, { decimals: true })} /> : null}
      <KeyValue label="Net payout" value={formatINR(s.net, { decimals: true })} emphasis />
      {s.payoutMethod ? <KeyValue label="Method" value={s.payoutMethod === "UPI" ? "UPI" : "Bank transfer"} /> : null}
      {s.utr ? <KeyValue label="UTR" value={s.utr} /> : null}
      {s.paidAt ? <KeyValue label="Paid on" value={formatDate(s.paidAt, true)} /> : null}
      {s.failureReason ? <KeyValue label="Failure reason" value={s.failureReason} valueColor="#b91c1c" /> : null}
    </SectionCard>
  );
}

function StoreStatement({ store }: { store: SettlementDetail["stores"][number] }) {
  return (
    <SectionCard title={store.name}>
      {store.lines.map((l) => (
        <KeyValue key={l.type} label={`${LedgerEntryTypeLabels[l.type]} (${l.count})`} value={signedINR(l.amount, { decimals: true })} valueColor={amountColor(l.amount)} />
      ))}
      <KeyValue label="Store total" value={signedINR(store.total, { decimals: true })} valueColor={amountColor(store.total)} emphasis />
    </SectionCard>
  );
}

export function SettlementScreen({ id }: { id: string }) {
  const toast = useToast();
  const { data: s, loading, error, reload } = useResource<SettlementDetail>(`/api/v1/ledger/settlements/${id}`);

  // The statement link is signed and expires in 15 minutes, so each tap uses the link from the latest load
  const download = () => {
    if (s) Linking.openURL(`${getApiUrl()}${s.statementUrl}`).catch(() => toast.show("Couldn't open the statement", "error"));
  };

  return (
    <ManageStackScreen
      title={s?.number ?? "Payout"}
      loading={loading}
      error={error}
      onRetry={reload}
      onRefresh={reload}
      actions={s ? <Button label="Download statement" icon="download-outline" onPress={download} style={{ flex: 1 }} /> : undefined}
    >
      {s && (
        <>
          <Totals s={s} />
          {s.carriedFrom.length > 0 ? (
            <SectionCard title="Carried in from">
              {s.carriedFrom.map((c) => <KeyValue key={c.id} label={c.number} value={formatINR(c.net, { decimals: true })} />)}
            </SectionCard>
          ) : null}
          {s.stores.map((store) => <StoreStatement key={store.storeId} store={store} />)}
        </>
      )}
    </ManageStackScreen>
  );
}
