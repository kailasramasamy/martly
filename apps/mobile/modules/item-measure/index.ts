import { requireOptionalNativeModule } from "expo";

/** What the phone read: sizes in mm, plus the details used to calibrate readings later */
export interface ItemCapture {
  shape: "ROUND" | "BOX" | "FLAT";
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  topDiameterMm?: number;
  baseDiameterMm?: number;
  baseScale?: number;
  fit?: number;
  tableHeight: number;
  topViewSlideMm: number;
  warnings: string[];
  /** The item's Front view outline, x and y from 0 to 1 within its bounding box */
  outline?: [number, number][];
  /** Local photo files, Top first */
  photos: string[];
  /** Set on a batch capture: the item's folder inside the batch */
  itemId?: string;
}

interface ItemMeasureNative {
  isSupported(): Promise<boolean>;
  capture(options?: { batchId?: string }): Promise<ItemCapture | null>;
  newBatchId(): Promise<string>;
  writeBatch(batchId: string, json: string): Promise<void>;
  listBatches(): Promise<string[]>;
  batchRoot(): Promise<string>;
  deleteBatchItem(batchId: string, itemId?: string): Promise<void>;
  exportBatch(batchId: string): Promise<boolean>;
}

// Absent on Android, where staff take normal photos and type the size
const native = requireOptionalNativeModule<ItemMeasureNative>("ItemMeasure");

export async function canMeasureItems() {
  return native ? native.isSupported() : false;
}

function measuring() {
  if (!native) throw new Error("Measuring isn't available on this phone");
  return native;
}

/** Opens the guided camera. Resolves with null if the person closes it. With a batch, the raw views are kept for the Mac. */
export function captureItem(batchId?: string) {
  return measuring().capture(batchId ? { batchId } : undefined);
}

/** Batches of raw captures kept on the phone until they're exported */
export const batchFiles = {
  newId: () => measuring().newBatchId(),
  write: (batchId: string, json: string) => measuring().writeBatch(batchId, json),
  list: () => measuring().listBatches(),
  root: () => measuring().batchRoot(),
  remove: (batchId: string, itemId?: string) => measuring().deleteBatchItem(batchId, itemId),
  /** Zips the batch and opens the share sheet; true once it was sent somewhere */
  export: (batchId: string) => measuring().exportBatch(batchId),
};
