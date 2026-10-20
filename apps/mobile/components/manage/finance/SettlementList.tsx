import { useRouter } from "expo-router";
import { SettlementStatusLabels } from "@martly/shared/constants";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { formatINR } from "../ui/tokens";
import { SETTLEMENT_PILL, shortDate } from "./format";
import { useFinanceScope } from "./use-finance-scope";
import type { Settlement } from "../../../lib/ledger-types";

export function SettlementList() {
  const router = useRouter();
  const { query } = useFinanceScope();
  const list = usePagedList<Settlement>("/api/v1/ledger/settlements", { organizationId: query.organizationId });

  return (
    <ManageListScreen
      title="Payouts"
      list={list}
      empty={{ icon: "cash-outline", title: "No payouts yet", message: "Your first statement appears after the next Monday run." }}
      renderItem={(s) => (
        <ListRow
          icon="document-text-outline"
          title={s.number}
          subtitle={`${shortDate(s.periodStart)} – ${shortDate(s.periodEnd)}`}
          value={formatINR(s.net, { decimals: true })}
          trailing={<StatusPill label={SettlementStatusLabels[s.status]} {...SETTLEMENT_PILL[s.status]} />}
          chevron
          onPress={() => router.push(`/manage/finance/settlements/${s.id}`)}
        />
      )}
    />
  );
}
