import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useKeyboardReveal } from "../../../lib/use-keyboard-reveal";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { manage } from "../ui/tokens";
import { SearchField } from "../ui/SearchField";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { ListRow } from "../ui/ListRow";
import { EmptyState } from "../ui/EmptyState";
import { StickyActionBar } from "../ui/StickyActionBar";
import { useStoreScope } from "../StoreScope";
import type { StoreProductItem } from "../inventory/types";
import { ReceiveLineRow, type ReceiveLine } from "./ReceiveLineRow";
import { useStockAccess } from "./use-stock-access";

const MIN_QUERY = 2;

function toLine(sp: StoreProductItem): ReceiveLine {
  return { storeProductId: sp.id, name: sp.product.name, variant: sp.variant.name, imageUrl: sp.variant.imageUrl ?? sp.product.imageUrl, qty: "1" };
}

/** Record a supplier delivery: pick store products, enter quantities received, add an optional reference note */
export function ReceiveScreen() {
  const router = useRouter();
  const keyboard = useKeyboardReveal<FlatList>();
  const { canReceive } = useStockAccess();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Choose the receiving store" });
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [note, setNote] = useState("");
  const { run, running } = useAction();
  const searching = q.trim().length >= MIN_QUERY;
  const results = usePagedList<StoreProductItem>("/api/v1/store-products", { storeId, q: q.trim() }, { pageSize: 15, enabled: searching && !!storeId });

  if (!canReceive) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't receive stock." />;

  const add = (sp: StoreProductItem) => {
    setLines((prev) => prev.some((l) => l.storeProductId === sp.id)
      ? prev.map((l) => (l.storeProductId === sp.id ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l))
      : [...prev, toLine(sp)]);
    setQ("");
  };
  const setQty = (id: string, qty: string) => setLines((prev) => prev.map((l) => (l.storeProductId === id ? { ...l, qty } : l)));
  const remove = (id: string) => setLines((prev) => prev.filter((l) => l.storeProductId !== id));
  const rows: (StoreProductItem | ReceiveLine)[] = searching ? results.items : lines;
  const valid = lines.length > 0 && lines.every((l) => Number(l.qty) > 0);

  const submit = async () => {
    const body = { storeId, lines: lines.map((l) => ({ storeProductId: l.storeProductId, quantity: Number(l.qty) })), ...(note.trim() ? { note: note.trim() } : {}) };
    const done = await run(() => api.post("/api/v1/stock/receive", body), "Stock received");
    if (done) router.back();
  };

  const header = (
    <View style={styles.header}>
      {picker}
      <SearchField value={q} onChange={setQ} placeholder={storeId ? "Search products to receive" : "Choose a store first"} />
    </View>
  );

  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
      <Stack.Screen options={{ title: "Receive stock" }} />
      <FlatList
        ref={keyboard.scrollRef}
        onScroll={keyboard.onScroll}
        scrollEventThrottle={16}
        data={rows}
        keyExtractor={(r) => ("storeProductId" in r ? r.storeProductId : r.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        onEndReached={searching ? results.loadMore : undefined}
        ListEmptyComponent={searching
          ? (results.loading ? null : <EmptyState icon="search-outline" title="No products found" message="Only products listed in this store can be received." />)
          : <EmptyState icon="download-outline" title="Nothing added yet" message="Search above and tap a product to add what arrived." />}
        ListFooterComponent={!searching && lines.length > 0 ? (
          <View style={styles.footer}>
            <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Supplier or invoice number" maxLength={500} />
          </View>
        ) : null}
        renderItem={({ item }) => "storeProductId" in item
          ? <ReceiveLineRow line={item} onQty={setQty} onRemove={remove} />
          : (
            <ListRow imageUrl={item.variant.imageUrl ?? item.product.imageUrl} title={item.product.name} subtitle={item.variant.name}
              caption={`${item.stock} in stock`} icon="add-circle-outline" onPress={() => add(item)} />
          )}
      />
      {!searching && lines.length > 0 && (
        <StickyActionBar>
          <Button label={`Receive ${lines.length} item${lines.length === 1 ? "" : "s"}`} onPress={submit} loading={running} disabled={!valid || !storeId} style={{ flex: 1 }} />
        </StickyActionBar>
      )}
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  header: { padding: 12, gap: 10 },
  footer: { padding: 14 },
});
