import { useRouter } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { KeyValue } from "../ui/KeyValue";
import { formatINR } from "../ui/tokens";
import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";
import { useAuth } from "../../../lib/auth-context";
import { colors, fonts } from "../../../constants/theme";
import { BalanceHero } from "./BalanceHero";
import { PayoutTiles } from "./PayoutTiles";
import { DuesCard } from "./DuesCard";
import { useFinanceScope } from "./use-finance-scope";
import type { LedgerSummary } from "../../../lib/ledger-types";

function StoreBreakdown({ stores }: { stores: LedgerSummary["stores"] }) {
  return (
    <SectionCard title="By store" flush>
      {stores.map((s) => (
        <View key={s.storeId} style={styles.store}>
          <Text style={styles.storeName} numberOfLines={1}>{s.name}</Text>
          <KeyValue label="Available" value={formatINR(s.available, { decimals: true })} />
          <KeyValue label="On hold" value={formatINR(s.onHold, { decimals: true })} />
        </View>
      ))}
    </SectionCard>
  );
}

export function FinanceOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const { query, isOwner, picker } = useFinanceScope();
  const { data, loading, error, reload } = useResource<LedgerSummary>(`/api/v1/ledger/summary${toQuery(query)}`);
  const owner = data?.owner;

  return (
    <ManageStackScreen title="Payments & payouts" loading={loading} error={error} onRetry={reload} onRefresh={reload}>
      {picker}
      {data && (
        <>
          {owner?.due ? <DuesCard amount={owner.due.amount} canPay={user?.role === "ORG_ADMIN"} onPaid={reload} /> : null}
          <BalanceHero summary={data} />
          <Text style={styles.rates}>
            Martly commission: {data.commission.onlinePct}% on online payments, {data.commission.codPct}% on COD and wallet (GST included)
          </Text>
          {owner ? <PayoutTiles owner={owner} codThisWeek={data.codThisWeek} /> : null}
          {data.stores.length > 1 ? <StoreBreakdown stores={data.stores} /> : null}
          <SectionCard flush>
            <ListRow title="Activity" subtitle="Every sale, refund and payout" icon="list-outline" chevron onPress={() => router.push("/manage/finance/activity")} />
            {isOwner ? <ListRow title="Payouts" subtitle="Statements for each weekly payout" icon="cash-outline" chevron onPress={() => router.push("/manage/finance/settlements")} /> : null}
            {isOwner ? <ListRow title="Payout account" subtitle="Where your payouts are sent" icon="business-outline" chevron onPress={() => router.push("/manage/finance/payout-account")} /> : null}
          </SectionCard>
        </>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  store: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eef1f4" },
  rates: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  storeName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
