import { useMemo, useState, type ReactElement } from "react";
import { View, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useManageScope } from "../../../../lib/manage-scope-context";
import { useToast } from "../../../../lib/toast-context";
import { batchFiles } from "../../../../modules/item-measure";
import { Loader } from "../../../Loader";
import { useStoreScope } from "../../StoreScope";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { EmptyState } from "../../ui/EmptyState";
import { StickyActionBar } from "../../ui/StickyActionBar";
import { BatchSummary } from "./BatchSummary";
import { manage } from "../../ui/tokens";
import { BatchItemRow } from "./BatchItemRow";
import { PendingItemCard } from "./PendingItemCard";
import { useBatchCapture } from "./use-batch-capture";
import type { BatchItem } from "./use-batch";

/** Each item's place among the sizes of its product, for items that have more than one size */
function groupPositions(items: BatchItem[]) {
  const groups = new Map<string, string[]>();
  for (const item of items) groups.set(item.groupId, [...(groups.get(item.groupId) ?? []), item.itemId]);
  const positions = new Map<string, { index: number; count: number }>();
  for (const ids of groups.values()) {
    if (ids.length > 1) ids.forEach((id, i) => positions.set(id, { index: i + 1, count: ids.length }));
  }
  return { positions, products: groups.size };
}

/** Zips and shares the batch, and notes when it was sent */
function useBatchExport(flow: ReturnType<typeof useBatchCapture>) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const run = async () => {
    const { batch } = flow;
    if (!batch) return;
    setExporting(true);
    try {
      if (await batchFiles.export(batch.batchId)) {
        await flow.markExported(batch);
        toast.show("Sent. Clear it from the phone once it's on the Mac.", "success");
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't export the batch", "error");
    } finally {
      setExporting(false);
    }
  };
  return { run, exporting };
}

interface HeaderProps {
  flow: ReturnType<typeof useBatchCapture>;
  picker: ReactElement | null;
  products: number;
  onClear: () => void;
}

function BatchHeader({ flow, picker, products, onClear }: HeaderProps) {
  return (
    <View style={styles.header}>
      {flow.batch ? <BatchSummary batch={flow.batch} products={products} onClear={onClear} /> : picker}
      {flow.pending && (
        <PendingItemCard
          key={flow.pending.capture.itemId}
          capture={flow.pending.capture}
          sizeNumber={flow.sizeNumber}
          saving={flow.saving}
          onSave={flow.save}
          onDiscard={flow.discard}
        />
      )}
    </View>
  );
}

/** Batch capture: measure items one after another at the shelf, price each, and AirDrop the batch to the Mac */
export function BatchCaptureScreen() {
  const flow = useBatchCapture();
  const { stores } = useManageScope();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Choose a store" });
  const [removing, setRemoving] = useState<BatchItem | null>(null);
  const { batch } = flow;
  const exporter = useBatchExport(flow);
  const [clearing, setClearing] = useState(false);
  const items = useMemo(() => batch?.items ?? [], [batch]);
  const { positions, products } = useMemo(() => groupPositions(items), [items]);

  const start = () => {
    const store = stores.find((s) => s.id === storeId);
    if (store) flow.captureFirst(store.id, store.name);
  };

  if (flow.loading) return <Loader style={styles.loading} size="large" />;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: "Batch capture" }} />
      <FlatList
        data={[...items].reverse()}
        keyExtractor={(item) => item.itemId}
        ListHeaderComponent={<BatchHeader flow={flow} picker={picker} products={products} onClear={() => setClearing(true)} />}
        ListEmptyComponent={flow.pending ? null : (
          <EmptyState icon="scan" title="Nothing captured yet" message="Measure each item, type its price, and go straight to the next. Export the batch when you're done." />
        )}
        renderItem={({ item, index }) => (
          <BatchItemRow item={item} photo={flow.photoUri(batch!, item)} number={items.length - index} sizeOf={positions.get(item.itemId)} onRemove={() => setRemoving(item)} />
        )}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      {!flow.pending && (
        <StickyActionBar>
          <Button label="Export" icon="share-outline" variant="secondary" onPress={exporter.run} loading={exporter.exporting} disabled={!items.length} style={styles.action} />
          <Button label={items.length ? "Capture next" : "Start capturing"} icon="scan" onPress={batch ? flow.captureNext : start} disabled={!batch && !storeId} style={styles.action} />
        </StickyActionBar>
      )}
      <ConfirmDialog
        visible={!!removing}
        title="Remove this item?"
        message="Its photos and measurements are deleted from the phone."
        confirmLabel="Remove"
        onConfirm={() => { if (batch && removing) flow.removeItem(batch, removing.itemId); setRemoving(null); }}
        onClose={() => setRemoving(null)}
      />
      <ConfirmDialog
        visible={clearing}
        title="Clear the batch from this phone?"
        message="Check the zip has arrived on the Mac first. Its photos and LiDAR data are deleted from the phone."
        confirmLabel="Clear batch"
        cancelLabel="Keep it"
        onConfirm={() => { if (batch) flow.finish(batch); setClearing(false); }}
        onClose={() => setClearing(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  loading: { marginTop: 80 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  action: { flex: 1 },
});
