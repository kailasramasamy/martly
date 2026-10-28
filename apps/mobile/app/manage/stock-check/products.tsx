import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { StockCheckProduct } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useResource } from "../../../lib/manage/use-resource";
import { Button } from "../../../components/manage/ui/Button";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { ListSkeleton } from "../../../components/manage/ui/ListSkeleton";
import { StickyActionBar } from "../../../components/manage/ui/StickyActionBar";
import { manage, tabular } from "../../../components/manage/ui/tokens";
import { SizeRow } from "../../../components/manage/stock-check/SizeRow";
import { EditSizesSheet } from "../../../components/manage/stock-check/EditSizesSheet";
import { useCarryActions } from "../../../components/manage/stock-check/use-carry-actions";

type Params = { storeId: string; departmentId: string; brandId: string; title?: string; status?: string };

/** Each size starts as the shop shows it now: confirmed as confirmed, guesses on, hidden suggestions off */
const startingChips = (products: StockCheckProduct[]) =>
  new Map(products.flatMap((p) => p.sizes.map((s) => [s.storeProductId, s.carried ?? s.isActive] as const)));

/** On/off per size: from the data, kept across reloads, switchable a size, a product or everything at a time */
function useChips(products: StockCheckProduct[] | null) {
  const [on, setOn] = useState<Map<string, boolean>>(new Map());
  // A reload after an edit brings new sizes; choices already made on screen stay
  useEffect(() => { if (products) setOn((prev) => new Map([...startingChips(products), ...prev])); }, [products]);
  const set = useCallback((ids: string[], value: boolean) => setOn((m) => new Map([...m, ...ids.map((id) => [id, value] as const)])), []);
  const toggle = useCallback((id: string) => setOn((m) => new Map(m).set(id, !m.get(id))), []);
  const setProduct = useCallback((product: StockCheckProduct, value: boolean) => set(product.sizes.map((s) => s.storeProductId), value), [set]);
  return { on, set, toggle, setProduct, setAll: (value: boolean) => set([...on.keys()], value) };
}

function SetAll({ count, total, onSet }: { count: number; total: number; onSet: (on: boolean) => void }) {
  return (
    <View style={styles.setAll}>
      <Text style={[styles.setAllText, tabular]}>{count} of {total} sizes carried</Text>
      <TouchableOpacity onPress={() => onSet(true)} hitSlop={8} accessibilityRole="button"><Text style={styles.link}>All on</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => onSet(false)} hitSlop={8} accessibilityRole="button"><Text style={styles.link}>All off</Text></TouchableOpacity>
    </View>
  );
}

/** A brand's products in one department with a chip per size; Save confirms every size on screen */
export default function StockCheckProductsScreen() {
  const p = useLocalSearchParams<Params>();
  const router = useRouter();
  const res = useResource<StockCheckProduct[]>(
    `/api/v1/stock-check/products?storeId=${p.storeId}&departmentId=${p.departmentId}&brandId=${p.brandId}&status=${p.status ?? "all"}`,
  );
  const { on, set, toggle, setProduct, setAll } = useChips(res.data);
  const [editing, setEditing] = useState<StockCheckProduct | null>(null);
  const actions = useCarryActions(p.storeId, useCallback(() => {}, []));
  const saveEdit = async (edit: Parameters<typeof actions.editProduct>[1]) => {
    if (!editing) return;
    const done = await actions.editProduct(editing.id, edit);
    if (!done) return;
    set(done.storeProductIds, true);
    setEditing(null);
    void res.reload();
  };
  const carried = useMemo(() => [...on.values()].filter(Boolean).length, [on]);
  const notSold = on.size - carried;

  const save = async () => {
    const items = [...on].map(([id, value]) => ({ id, carried: value }));
    const done = await actions.saveSizes(items, `${p.title ?? "Brand"}: ${carried} carried, ${notSold} not sold`);
    if (done) router.back();
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: p.title ?? "Sizes" }} />
      {res.loading ? <ListSkeleton /> : (
        <FlatList
          data={res.data ?? []}
          keyExtractor={(item) => item.id}
          extraData={on}
          renderItem={({ item }) => <SizeRow product={item} on={on} onToggle={toggle} onProduct={setProduct} onEdit={setEditing} />}
          ListHeaderComponent={on.size > 0 ? <SetAll count={carried} total={on.size} onSet={setAll} /> : null}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="No products" />}
        />
      )}
      {on.size > 0 && (
        <StickyActionBar>
          <Button label={`Save · ${carried} carried${notSold > 0 ? `, ${notSold} not sold` : ""}`} icon="checkmark" loading={actions.running} onPress={save} style={styles.grow} />
        </StickyActionBar>
      )}
      <EditSizesSheet product={editing} running={actions.running} onSave={saveEdit} onClose={() => setEditing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  setAll: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: manage.line },
  setAllText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  grow: { flex: 1 },
});
