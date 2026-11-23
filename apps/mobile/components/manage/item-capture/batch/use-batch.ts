import { useCallback, useEffect, useState } from "react";
import { batchFiles, type ItemCapture } from "../../../../modules/item-measure";

export type BatchReading = Omit<ItemCapture, "photos" | "itemId">;

/** One captured item; items sharing a groupId are sizes of the same product */
export interface BatchItem {
  itemId: string;
  groupId: string;
  price: number;
  flat: boolean;
  capturedAt: string;
  reading: BatchReading;
  photoCount: number;
}

/** batch.json, read by apps/api/scripts/item-batch on the Mac */
export interface BatchManifest {
  version: 1;
  batchId: string;
  storeId: string;
  storeName: string;
  createdAt: string;
  items: BatchItem[];
  /** When the batch was last sent, and how many items it had then */
  exportedAt?: string;
  exportedCount?: number;
}

/** The one batch kept on the phone until it's exported, with its items' raw views in the module's batch folder */
export function useBatch() {
  const [batch, setBatch] = useState<BatchManifest | null>(null);
  const [root, setRoot] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([batchFiles.list(), batchFiles.root()])
      .then(([manifests, folder]) => {
        const saved = manifests.map((json) => JSON.parse(json) as BatchManifest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setBatch(saved[0] ?? null);
        setRoot(folder.replace(/\/$/, ""));
      })
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (next: BatchManifest) => {
    await batchFiles.write(next.batchId, JSON.stringify(next));
    setBatch(next);
  }, []);

  const start = async (storeId: string, storeName: string) => {
    const manifest: BatchManifest = { version: 1, batchId: await batchFiles.newId(), storeId, storeName, createdAt: new Date().toISOString(), items: [] };
    await save(manifest);
    return manifest;
  };

  const addItem = async (current: BatchManifest, capture: ItemCapture, groupId: string, price: number) => {
    const { photos, itemId, ...reading } = capture;
    const item: BatchItem = {
      itemId: itemId!, groupId, price, flat: reading.shape === "FLAT", capturedAt: new Date().toISOString(), reading, photoCount: photos.length,
    };
    await save({ ...current, items: [...current.items, item] });
  };

  const removeItem = async (current: BatchManifest, itemId: string) => {
    await batchFiles.remove(current.batchId, itemId);
    await save({ ...current, items: current.items.filter((item) => item.itemId !== itemId) });
  };

  const markExported = (current: BatchManifest) => save({ ...current, exportedAt: new Date().toISOString(), exportedCount: current.items.length });

  const finish = async (current: BatchManifest) => {
    await batchFiles.remove(current.batchId);
    setBatch(null);
  };

  /** Front view for standing items (photo 1), the first top view for flat ones */
  const photoUri = (current: BatchManifest, item: BatchItem) => `${root}/${current.batchId}/${item.itemId}/photo_${item.flat ? 0 : 1}.jpg`;

  return { batch, loading, start, addItem, removeItem, markExported, finish, photoUri };
}
