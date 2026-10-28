import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import type { StockCheckDepartment, StockCheckSummary } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { Loader } from "../../../components/Loader";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { KpiTile } from "../../../components/manage/ui/KpiTile";
import { manage } from "../../../components/manage/ui/tokens";
import { CarryHero } from "../../../components/manage/stock-check/CarryHero";
import { DepartmentCard, type DepartmentFocus } from "../../../components/manage/stock-check/DepartmentCard";
import { useCarryActions } from "../../../components/manage/stock-check/use-carry-actions";

const n = (v: number) => v.toLocaleString("en-IN");

const FOCUS_LABEL: Record<DepartmentFocus, string> = { carried: "Departments with carried products", notCarried: "Departments with products not sold" };

function Header({ picker, summary, focus, onFocus }: {
  picker: React.ReactNode; summary: StockCheckSummary; focus: DepartmentFocus | null; onFocus: (f: DepartmentFocus | null) => void;
}) {
  return (
    <View style={styles.header}>
      {picker && <View style={styles.pad}>{picker}</View>}
      <View style={styles.pad}><CarryHero summary={summary} /></View>
      <View style={[styles.pad, styles.tiles]}>
        <KpiTile label="Pending" value={n(summary.unchecked)} />
        <KpiTile label="Carried" value={n(summary.carried)} onPress={summary.carried > 0 ? () => onFocus("carried") : undefined} />
        <KpiTile label="Not sold" value={n(summary.notCarried)} onPress={summary.notCarried > 0 ? () => onFocus("notCarried") : undefined} />
        <KpiTile label="Hidden" value={n(summary.suggested)} />
      </View>
      {focus && (
        <View style={[styles.pad, styles.focus]}>
          <Text style={styles.focusText}>{FOCUS_LABEL[focus]}</Text>
          <TouchableOpacity onPress={() => onFocus(null)} hitSlop={12} accessibilityRole="button"><Text style={styles.focusClear}>Show all</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Confirm what the store really carries, a department at a time: all of it, none of it, or brand by brand */
export default function StockCheckScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ required: true, persist: true, placeholder: "Pick a store" });
  const summary = useResource<StockCheckSummary>(storeId ? `/api/v1/stock-check/summary?storeId=${storeId}` : null);
  const { reload } = summary;
  const actions = useCarryActions(storeId, useCallback(() => { void reload(); }, [reload]));
  const [none, setNone] = useState<StockCheckDepartment | null>(null);
  const [focus, setFocus] = useState<DepartmentFocus | null>(null);
  if (!can(user, "stock-check", "list")) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't change what's on sale." />;

  const openBrands = (d: StockCheckDepartment) => router.push({ pathname: "/manage/stock-check/brands", params: { storeId, departmentId: d.id, title: d.name, ...(focus ? { status: focus } : {}) } });
  const all = (d: StockCheckDepartment) => actions.decide({ departmentId: d.id }, true, (count) => `${d.name}: ${n(count)} carried`);
  const hideAll = async () => {
    if (!none) return;
    await actions.decide({ departmentId: none.id }, false, (count) => `${none.name}: ${n(count)} taken off your shop`);
    setNone(null);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Stock check" }} />
      {!storeId ? <View style={styles.pad}>{picker}</View> : summary.loading || !summary.data ? <Loader style={styles.loading} size="large" /> : (
        <FlatList
          data={focus ? summary.data.departments.filter((d) => d[focus] > 0) : summary.data.departments}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DepartmentCard department={item} focus={focus ?? undefined} onAll={() => all(item)} onSome={() => openBrands(item)} onNone={() => setNone(item)} />
          )}
          ListHeaderComponent={<Header picker={picker} summary={summary.data} focus={focus} onFocus={setFocus} />}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="Nothing listed yet" message="Products listed at onboarding show up here to confirm." />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.primary} />}
        />
      )}
      <ConfirmDialog
        visible={none !== null} title={`Hide ${n(none?.unchecked ?? 0)} ${none?.name ?? ""} products?`}
        message="Everything here you haven't confirmed is taken off your shop. Products you already marked carried stay."
        confirmLabel="Not sold here" running={actions.running} onConfirm={hideAll} onClose={() => setNone(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  header: { gap: 12, paddingTop: 12, paddingBottom: 4 },
  pad: { paddingHorizontal: 16 },
  tiles: { flexDirection: "row", gap: 8 },
  focus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  focusText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  focusClear: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  list: { gap: 10, paddingBottom: 32 },
  loading: { paddingVertical: 32 },
});
