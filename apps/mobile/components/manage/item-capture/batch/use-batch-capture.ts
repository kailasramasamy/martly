import { useState } from "react";
import { batchFiles, captureItem, type ItemCapture } from "../../../../modules/item-measure";
import { useToast } from "../../../../lib/toast-context";
import { useBatch, type BatchManifest } from "./use-batch";

interface Pending {
  capture: ItemCapture;
  groupId: string;
}

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** The shelf loop: camera, price, camera again, with each item saved to the batch as it goes */
export function useBatchCapture() {
  const toast = useToast();
  const store = useBatch();
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);

  const capture = async (current: BatchManifest, groupId?: string) => {
    try {
      const result = await captureItem(current.batchId);
      if (result?.itemId) setPending({ capture: result, groupId: groupId ?? result.itemId });
    } catch (err) {
      toast.show(message(err, "Couldn't open the camera"), "error");
    }
  };

  /** Starts a batch for the store on the first capture */
  const captureFirst = async (storeId: string, storeName: string) => {
    try {
      await capture(store.batch ?? (await store.start(storeId, storeName)));
    } catch (err) {
      toast.show(message(err, "Couldn't start the batch"), "error");
    }
  };

  const save = async (price: number, anotherSize: boolean) => {
    if (!pending || !store.batch) return;
    setSaving(true);
    try {
      await store.addItem(store.batch, pending.capture, pending.groupId, price);
    } catch (err) {
      toast.show(message(err, "Couldn't save the item"), "error");
      return;
    } finally {
      setSaving(false);
    }
    setPending(null);
    await capture(store.batch, anotherSize ? pending.groupId : undefined);
  };

  const discard = async () => {
    if (!pending || !store.batch) return;
    await batchFiles.remove(store.batch.batchId, pending.capture.itemId);
    setPending(null);
  };

  const sizeNumber = pending && store.batch ? store.batch.items.filter((item) => item.groupId === pending.groupId).length + 1 : 1;

  return { ...store, pending, saving, sizeNumber, captureFirst, captureNext: () => store.batch && capture(store.batch), save, discard };
}
