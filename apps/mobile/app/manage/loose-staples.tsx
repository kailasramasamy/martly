import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../lib/auth-context";
import { colors, fonts, radius } from "../../constants/theme";
import { ManageListScreen } from "../../components/manage/ManageListScreen";
import { useStoreScope } from "../../components/manage/StoreScope";
import { Button } from "../../components/manage/ui/Button";
import { EmptyState } from "../../components/manage/ui/EmptyState";
import { SegmentedTabs } from "../../components/manage/ui/SegmentedTabs";
import { StickyActionBar } from "../../components/manage/ui/StickyActionBar";
import { manage, tabular } from "../../components/manage/ui/tokens";
import { AisleCard } from "../../components/manage/loose-staples/AisleCard";
import { useLooseStaples, visibleAisles, type StapleFilter } from "../../components/manage/loose-staples/use-loose-staples";

function SaveBar({ count, openingStock, onStock, onSave, running }: {
  count: number; openingStock: string; onStock: (v: string) => void; onSave: () => void; running: boolean;
}) {
  return (
    <StickyActionBar>
      <View style={styles.stock}>
        <Text style={styles.stockLabel}>New stock</Text>
        <TextInput
          style={[styles.stockInput, tabular]} value={openingStock} onChangeText={(v) => onStock(v.replace(/\D/g, ""))}
          keyboardType="number-pad" maxLength={5} accessibilityLabel="Opening stock for each newly listed size"
        />
      </View>
      <Button label={count ? `Save ${count} ${count === 1 ? "price" : "prices"}` : "Type prices to save"} icon="checkmark"
        onPress={onSave} loading={running} disabled={count === 0} style={styles.save} />
    </StickyActionBar>
  );
}

/** Unbranded rice, dal, atta and spices: a price per size, started from suggestions; saved sizes go on sale and lead their aisles */
export default function LooseStaplesScreen() {
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Pick a store", routeParam: true });
  const staples = useLooseStaples(storeId);
  const [filter, setFilter] = useState<StapleFilter>("TO_PRICE");
  const [q, setQ] = useState("");
  const aisles = useMemo(() => visibleAisles(staples.data ?? [], filter, q), [staples.data, filter, q]);
  const totals = useMemo(() => new Map((staples.data ?? []).map((a) => [a.subcategoryId, { listed: a.items.filter((i) => i.listed?.isActive).length, sizes: a.items.length }])), [staples.data]);
  if (!can(user, "loose-staples", "list")) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't list products or set prices." />;

  const listed = staples.all.filter((i) => i.listed).length;
  const tabs = [
    { value: "TO_PRICE" as const, label: "To price", count: staples.all.length - listed },
    { value: "LISTED" as const, label: "On sale", count: listed },
    { value: "ALL" as const, label: "All" },
  ];
  const list = { items: aisles, loading: staples.loading, refreshing: false, loadingMore: false, error: staples.error, refresh: staples.reload, loadMore: () => undefined };

  return (
    <ManageListScreen
      title="Loose staples"
      list={list}
      search={storeId ? { value: q, onChange: setQ, placeholder: "Search rice, dal, atta…" } : undefined}
      filters={(
        <>
          {picker}
          <SegmentedTabs options={tabs} value={filter} onChange={setFilter} countTone="neutral" />
          {filter !== "LISTED" && aisles.length > 0 && (
            <TouchableOpacity onPress={() => staples.fillSuggested(aisles.flatMap((a) => a.items))} accessibilityRole="button" style={styles.fillAll}>
              <Text style={styles.fillAllText}>Fill every suggested price below</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      empty={{ icon: "basket-outline", title: filter === "LISTED" ? "Nothing on sale yet" : "All priced", message: "Loose staples you price show first in their aisles." }}
      renderItem={(aisle) => (
        <AisleCard aisle={aisle} total={totals.get(aisle.subcategoryId) ?? { listed: 0, sizes: aisle.items.length }}
          drafts={staples.drafts} onPrice={staples.setPrice} onFill={staples.fillSuggested} />
      )}
      footer={storeId ? <SaveBar count={staples.changes.length} openingStock={staples.openingStock} onStock={staples.setOpeningStock} onSave={staples.save} running={staples.running} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  fillAll: { minHeight: 36, justifyContent: "center", alignSelf: "flex-start" },
  fillAllText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
  stock: { width: 96, justifyContent: "center" },
  stockLabel: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.6, color: manage.muted, textTransform: "uppercase" },
  stockInput: { height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: manage.line, paddingHorizontal: 8, marginTop: 2, fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  save: { flex: 1 },
});
