import { useCallback, useMemo, useState } from "react";
import { View, FlatList, RefreshControl, StyleSheet } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { StockCheckBrand, StockCheckSummary } from "@martly/shared/types";
import { colors } from "../../../constants/theme";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useResource } from "../../../lib/manage/use-resource";
import { Loader } from "../../../components/Loader";
import { Button } from "../../../components/manage/ui/Button";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { ListSkeleton } from "../../../components/manage/ui/ListSkeleton";
import { SearchField } from "../../../components/manage/ui/SearchField";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { StickyActionBar } from "../../../components/manage/ui/StickyActionBar";
import { manage } from "../../../components/manage/ui/tokens";
import { BrandCard, type BrandTab } from "../../../components/manage/stock-check/BrandCard";
import { useCarryActions } from "../../../components/manage/stock-check/use-carry-actions";

type Params = { storeId: string; departmentId: string; title?: string; status?: BrandTab };
const TABS: { value: BrandTab; label: string }[] = [
  { value: "unchecked", label: "To confirm" }, { value: "carried", label: "Carried" }, { value: "notCarried", label: "Not sold" }, { value: "all", label: "All brands" },
];
const EMPTY: Record<BrandTab, { title: string; message?: string }> = {
  unchecked: { title: "Every brand here is confirmed", message: "Brands you said no to are under Not sold." },
  carried: { title: "Nothing carried here yet" },
  notCarried: { title: "Nothing ruled out here", message: "Brands you say no to land here, so you can sell them again later." },
  all: { title: "No brands found" },
};
const n = (v: number) => v.toLocaleString("en-IN");

/** Decided brands stay on screen, collapsed to their answer, until the list next reloads */
function useDecided() {
  const [decided, setDecided] = useState<Map<string, { carried: boolean; batch: string }>>(new Map());
  const add = useCallback((id: string, carried: boolean, batch: string) => setDecided((m) => new Map(m).set(id, { carried, batch })), []);
  const dropBatch = useCallback((batch: string) => setDecided((m) => new Map([...m].filter(([, d]) => d.batch !== batch))), []);
  return { decided, add, dropBatch, clear: useCallback(() => setDecided(new Map()), []) };
}

/** The rest of a department in one go, behind a confirmation with the count */
function RestBar({ left, deptName, running, onDecide }: { left: number; deptName: string; running: boolean; onDecide: (carried: boolean) => Promise<void> }) {
  const [rest, setRest] = useState<boolean | null>(null);
  if (left === 0) return null;
  return (
    <>
      <StickyActionBar>
        <Button label={`Rest (${n(left)}): carried`} icon="checkmark-done" compact onPress={() => setRest(true)} style={styles.grow} />
        <Button label="Not sold" variant="danger" compact onPress={() => setRest(false)} style={styles.grow} />
      </StickyActionBar>
      <ConfirmDialog
        visible={rest !== null}
        title={rest ? `Carry the other ${n(left)}?` : `Hide the other ${n(left)}?`}
        message={rest
          ? `Everything in ${deptName} you haven't confirmed is marked carried and shown on your shop.`
          : `Everything in ${deptName} you haven't confirmed is taken off your shop.`}
        confirmLabel={rest ? "Mark carried" : "Not sold here"} confirmVariant={rest ? "primary" : "danger"}
        running={running} onConfirm={async () => { if (rest !== null) await onDecide(rest); setRest(null); }} onClose={() => setRest(null)}
      />
    </>
  );
}

type Decided = ReturnType<typeof useDecided>;

function BrandList({ list, tab, d, onDecide, onSizes, onUndo }: {
  list: ReturnType<typeof usePagedList<StockCheckBrand>>; tab: BrandTab; d: Decided;
  onDecide: (b: StockCheckBrand, carried: boolean) => void; onSizes: (b: StockCheckBrand) => void; onUndo: (batch: string) => void;
}) {
  return (
    <FlatList
      data={list.items}
      keyExtractor={(b) => b.id}
      extraData={d.decided}
      renderItem={({ item }) => {
        const done = d.decided.get(item.id);
        return (
          <BrandCard
            brand={item} tab={tab} decided={done?.carried} onYes={() => onDecide(item, true)} onNo={() => onDecide(item, false)}
            onSizes={() => onSizes(item)} onUndo={() => { if (done) onUndo(done.batch); }}
          />
        );
      }}
      ListEmptyComponent={<EmptyState icon="checkmark-done-circle-outline" {...EMPTY[tab]} />}
      ListFooterComponent={list.loadingMore ? <Loader style={styles.more} /> : null}
      contentContainerStyle={styles.list}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => { d.clear(); list.refresh(); }} tintColor={colors.primary} />}
    />
  );
}

/** One department's brands, best sellers first: yes, no, or pick the sizes; the rest of the department in one go at the end */
export default function StockCheckBrandsScreen() {
  const p = useLocalSearchParams<Params>();
  const router = useRouter();
  const [status, setStatus] = useState<BrandTab>(p.status ?? "unchecked");
  const [q, setQ] = useState("");
  const summary = useResource<StockCheckSummary>(`/api/v1/stock-check/summary?storeId=${p.storeId}`);
  const params = useMemo(() => ({ storeId: p.storeId, departmentId: p.departmentId, status, q }), [p.storeId, p.departmentId, status, q]);
  const list = usePagedList<StockCheckBrand>("/api/v1/stock-check/brands", params, { pageSize: 30 });
  const d = useDecided();
  const { reload: reloadSummary } = summary;
  const actions = useCarryActions(p.storeId, useCallback(() => { void reloadSummary(); }, [reloadSummary]), d.dropBatch);
  const deptName = p.title ?? "this department";

  // Carried and Not sold tabs flip what's there; the others answer only what's still to confirm
  const decide = async (b: StockCheckBrand, carried: boolean) => {
    const only = status === "carried" || status === "notCarried" ? status : "unchecked";
    const res = await actions.decide({ departmentId: p.departmentId, brandId: b.id, only }, carried, (count) => `${b.name}: ${n(count)} ${carried ? "carried" : "not sold"}`);
    if (res) d.add(b.id, carried, res.batch);
  };
  const decideRest = async (carried: boolean) => {
    const res = await actions.decide({ departmentId: p.departmentId }, carried, (count) => `${deptName}: ${n(count)} more ${carried ? "carried" : "not sold"}`);
    if (res) router.back();
  };
  const openSizes = (b: StockCheckBrand) => router.push({
    pathname: "/manage/stock-check/products", params: { storeId: p.storeId, departmentId: p.departmentId, brandId: b.id, title: b.name, status },
  });

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: deptName }} />
      <View style={styles.toolbar}>
        <SearchField value={q} onChange={(text) => { d.clear(); setQ(text); }} placeholder="Search brands or products" />
        <SegmentedTabs options={TABS} value={status} onChange={(s) => { d.clear(); setStatus(s); }} />
      </View>
      {list.loading ? <ListSkeleton /> : <BrandList list={list} tab={status} d={d} onDecide={decide} onSizes={openSizes} onUndo={(batch) => { void actions.undo(batch); }} />}
      <RestBar
        left={status === "unchecked" ? summary.data?.departments.find((x) => x.id === p.departmentId)?.unchecked ?? 0 : 0}
        deptName={deptName} running={actions.running} onDecide={decideRest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  toolbar: { padding: 12, gap: 10, backgroundColor: manage.canvas, borderBottomWidth: 1, borderBottomColor: manage.line },
  list: { gap: 10, paddingVertical: 12 },
  more: { paddingVertical: 20 },
  grow: { flex: 1 },
});
