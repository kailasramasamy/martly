import { useCallback, useMemo, useState } from "react";
import { View, FlatList, RefreshControl, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import type { PriceReviewGroup, PriceReviewSummary } from "@martly/shared/types";
import { colors } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useResource } from "../../../lib/manage/use-resource";
import { Loader } from "../../../components/Loader";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { OptionSheet } from "../../../components/manage/ui/OptionSheet";
import { manage } from "../../../components/manage/ui/tokens";
import { GroupCard } from "../../../components/manage/price-review/GroupCard";
import { BulkDialog, type BulkKind } from "../../../components/manage/price-review/BulkDialog";
import { OverviewHeader, type GroupBy, type QueueFilter } from "../../../components/manage/price-review/OverviewHeader";
import { useReviewActions } from "../../../components/manage/price-review/use-review-actions";
import { useGroupBulk } from "../../../components/manage/price-review/use-group-bulk";

const MORE_OPTIONS = [
  { value: "percentOffMrp", label: "Set price below MRP…", description: "One discount for everything still waiting" },
  { value: "hide", label: "Not sold here", description: "Take what's still waiting off your shop" },
];

function GroupsEmpty({ loading, allDone }: { loading: boolean; allDone: boolean }) {
  if (loading) return <Loader style={styles.loading} />;
  return allDone
    ? <EmptyState icon="checkmark-done-circle-outline" title="Every price is checked" message="New products you list later show up here to check." />
    : <EmptyState icon="search-outline" title="Nothing left here" message="Try another department or search." />;
}

/** The ⋯ actions for a brand or aisle, then the confirmation with its count */
function GroupBulkSheets({ bulk: g, running }: { bulk: ReturnType<typeof useGroupBulk>; running: boolean }) {
  return (
    <>
      <OptionSheet
        visible={g.more !== null} title={g.more?.name ?? ""} options={MORE_OPTIONS} value={null}
        onPick={(v) => { if (g.more) g.setBulk({ kind: v as BulkKind, group: g.more }); g.setMore(null); }}
        onClose={() => g.setMore(null)}
      />
      <BulkDialog
        kind={g.bulk?.kind ?? null} name={g.bulk?.group.name ?? ""} pending={g.bulk?.group.pending ?? 0}
        running={running} onConfirm={g.run} onClose={() => g.setBulk(null)}
      />
    </>
  );
}

/** Settle the prices a store was onboarded with: progress up top, then brands or aisles to clear in one go */
export default function PriceReviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ required: true, persist: true, placeholder: "Pick a store" });
  const [by, setBy] = useState<GroupBy>("brand");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const summary = useResource<PriceReviewSummary>(storeId ? `/api/v1/price-review/summary?storeId=${storeId}` : null);
  const params = useMemo(() => ({ storeId: storeId ?? "", by, departmentId, q }), [storeId, by, departmentId, q]);
  const groups = usePagedList<PriceReviewGroup>("/api/v1/price-review/groups", params, { enabled: !!storeId, pageSize: 30 });
  const { reload: reloadSummary } = summary;
  const { reload: reloadGroups } = groups;
  const refreshAll = useCallback(() => { void reloadSummary(); reloadGroups(); }, [reloadSummary, reloadGroups]);
  const actions = useReviewActions(storeId, refreshAll);
  const groupBulk = useGroupBulk(by, actions);
  if (!can(user, "price-review", "list")) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't change prices." />;

  const openGroup = (g: PriceReviewGroup) => router.push({ pathname: "/manage/price-review/items", params: { storeId, title: g.name, ...groupBulk.scopeOf(g) } });
  const openQueue = (f: QueueFilter) => router.push({ pathname: "/manage/price-review/items", params: { storeId, ...f, ...(departmentId ? { departmentId } : {}) } });

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Price review" }} />
      {!storeId ? <View style={styles.pad}>{picker}</View> : summary.loading ? <Loader style={styles.loading} size="large" /> : (
        <FlatList
          data={groups.loading ? [] : groups.items}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <GroupCard group={item} logo={by === "brand"} onReview={() => openGroup(item)}
              onAllOk={() => groupBulk.setBulk({ kind: "confirm", group: item })} onMore={() => groupBulk.setMore(item)} />
          )}
          ListHeaderComponent={summary.data && (
            <OverviewHeader
              storeId={storeId} picker={picker} summary={summary.data} departmentId={departmentId} onDepartment={setDepartmentId}
              by={by} onBy={setBy} q={q} onSearch={setQ} onOpenQueue={openQueue}
            />
          )}
          ListEmptyComponent={<GroupsEmpty loading={groups.loading} allDone={summary.data?.pending === 0} />}
          ListFooterComponent={groups.loadingMore ? <Loader style={styles.loading} /> : null}
          contentContainerStyle={styles.list}
          onEndReached={groups.loadMore}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={groups.refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
        />
      )}
      <GroupBulkSheets bulk={groupBulk} running={actions.running} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  pad: { padding: 16 },
  list: { gap: 10, paddingBottom: 32 },
  loading: { paddingVertical: 32 },
});
