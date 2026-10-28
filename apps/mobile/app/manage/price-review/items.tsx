import { View, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { colors } from "../../../constants/theme";
import { useKeyboardReveal } from "../../../lib/use-keyboard-reveal";
import { Loader } from "../../../components/Loader";
import { Button } from "../../../components/manage/ui/Button";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { ListSkeleton } from "../../../components/manage/ui/ListSkeleton";
import { SearchField } from "../../../components/manage/ui/SearchField";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { StickyActionBar } from "../../../components/manage/ui/StickyActionBar";
import { manage } from "../../../components/manage/ui/tokens";
import { ReviewRow } from "../../../components/manage/price-review/ReviewRow";
import { QuickBar } from "../../../components/manage/price-review/QuickBar";
import { BulkDialog } from "../../../components/manage/price-review/BulkDialog";
import { useItemsScreen, type Tab } from "../../../components/manage/price-review/use-items-screen";
import { decisionFor } from "../../../components/manage/price-review/use-review-queue";

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "To check" }, { value: "KEPT", label: "Kept" }, { value: "CHANGED", label: "Changed" }, { value: "notCarried", label: "Not sold" },
];

type Screen = ReturnType<typeof useItemsScreen>;

/** The keypad's quick bar while a row is open; otherwise, on a brand or aisle, one tap marks the rest OK */
function Footer({ s }: { s: Screen }) {
  const { active, queue } = s;
  if (active) {
    return (
      <QuickBar
        mrp={queue.draft.mrp === "" ? active.masterMrp : Number(queue.draft.mrp) || null}
        changed={decisionFor(active, queue.draft).outcome === "CHANGED"}
        running={s.actions.running} canHide={s.canHide}
        onPrice={(price) => queue.setDraft({ ...queue.draft, price: String(price) })}
        onHide={() => queue.settle(active, queue.draft, true)}
        onSave={() => queue.settle(active, queue.draft)}
      />
    );
  }
  if (s.tab !== "pending" || !s.scope || s.left === 0) return null;
  return (
    <StickyActionBar>
      <Button label={`Mark the remaining ${s.left} as OK`} icon="checkmark-done" onPress={() => s.setBulkOpen(true)} style={styles.grow} />
    </StickyActionBar>
  );
}

function ReviewList({ s }: { s: Screen }) {
  const { list, queue } = s;
  return (
    <FlatList
      ref={s.listRef}
      data={list.items}
      keyExtractor={(i) => i.id}
      extraData={[queue.activeId, queue.draft, queue.settled]}
      renderItem={({ item }) => (
        <ReviewRow
          item={item} active={item.id === queue.activeId} draft={queue.draft} settledAs={queue.settled.get(item.id)?.outcome ?? (item.carried === false ? "notCarried" : undefined)}
          onOpen={() => queue.open(item)} onKeep={() => queue.settle(item, { price: String(item.price), mrp: item.mrp === null ? "" : String(item.mrp) })}
          onDraft={queue.setDraft} onSubmit={() => queue.settle(item, queue.draft)} onUndo={() => s.undo(item)}
        />
      )}
      onScrollToIndexFailed={({ averageItemLength, index }) => s.listRef.current?.scrollToOffset({ offset: averageItemLength * index })}
      onEndReached={s.onEnd}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
      ListEmptyComponent={s.tab === "pending"
        ? <EmptyState icon="checkmark-done-circle-outline" title="All checked here" message="Every price on this list has been looked at." />
        : <EmptyState icon="file-tray-outline" title="Nothing here yet" />}
      ListFooterComponent={list.loadingMore ? <Loader style={styles.more} /> : null}
    />
  );
}

/** The review queue for a brand, an aisle or the whole store: best sellers first, one row open at a time */
export default function PriceReviewItemsScreen() {
  const s = useItemsScreen();
  const keyboard = useKeyboardReveal<FlatList>();
  return (
    <View ref={keyboard.rootRef} style={styles.root} onLayout={keyboard.onRootLayout}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
        <Stack.Screen options={{ title: s.p.title ?? "Prices to check" }} />
        <View style={styles.toolbar}>
          <SearchField value={s.q} onChange={(text) => { s.queue.reset(); s.setQueryText(text); }} placeholder="Search products" />
          <SegmentedTabs
            options={TABS.map((t) => ({ ...t, count: s.counts[t.value] }))} value={s.tab} countTone="neutral"
            onChange={(t) => { s.queue.reset(); s.setTab(t); }}
          />
        </View>
        {s.list.loading ? <ListSkeleton /> : <ReviewList s={s} />}
        <Footer s={s} />
      </KeyboardAvoidingView>
      <BulkDialog
        kind={s.bulkOpen ? "confirm" : null} name={s.p.title ?? ""} pending={s.left} running={s.actions.running}
        onConfirm={s.confirmRest} onClose={() => s.setBulkOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  toolbar: { padding: 12, gap: 10, backgroundColor: manage.canvas, borderBottomWidth: 1, borderBottomColor: manage.line },
  more: { paddingVertical: 20 },
  grow: { flex: 1 },
});
