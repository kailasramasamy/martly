import type { ItemShape } from "../constants/index.js";

/** Size of an unpacked item, in mm. Which fields apply depends on the shape. */
export interface ItemSize {
  shape: ItemShape;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  topDiameterMm?: number | null;
  baseDiameterMm?: number | null;
}

export const ITEM_SIZE_LABELS = { diameter: "Diameter", baseDiameter: "Diameter at the base", length: "Length", width: "Width", height: "Height" } as const;

/** The sizes each shape can't go without */
export const NEEDED_ITEM_SIZES = {
  ROUND: ["topDiameterMm", "heightMm"],
  BOX: ["lengthMm", "widthMm", "heightMm"],
  FLAT: ["lengthMm", "widthMm"],
} as const satisfies Record<ItemShape, readonly (keyof Omit<ItemSize, "shape">)[]>;

/** Rounded to 0.5 cm, since that's what the phone can honestly promise */
export function formatCm(mm: number) {
  const value = Math.round(mm / 5) / 2;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} cm`;
}

/** The variant's name: the item's main size */
export function formatItemSize(size: ItemSize): string {
  if (size.shape === "ROUND") return size.topDiameterMm ? formatCm(size.topDiameterMm) : "Standard";
  if (size.lengthMm && size.widthMm) return `${formatCm(size.lengthMm).replace(" cm", "")} × ${formatCm(size.widthMm)}`;
  return "Standard";
}

/** Each measurement on its own line for the product page, such as ["Diameter", "15 cm"] */
export function itemSizeRows(size: ItemSize): { label: "diameter" | "baseDiameter" | "length" | "width" | "height"; value: string }[] {
  const rows: ReturnType<typeof itemSizeRows> = [];
  const add = (label: (typeof rows)[number]["label"], mm?: number | null) => {
    if (mm) rows.push({ label, value: formatCm(mm) });
  };
  add("diameter", size.topDiameterMm);
  if (size.baseDiameterMm !== size.topDiameterMm) add("baseDiameter", size.baseDiameterMm);
  add("length", size.lengthMm);
  add("width", size.widthMm);
  add("height", size.heightMm);
  return rows;
}

const frustum = (top: number, base: number, height: number) => (height / 3) * (top + base + Math.sqrt(top * base));

/** Rounds to what the estimate can support: nearest 50 ml below 2 L, then nearest 500 ml */
function roundCapacity(ml: number) {
  const step = ml < 2000 ? 50 : 500;
  return Math.max(step, Math.round(ml / step) * step);
}

/** Volume inside the item's outer shape, in ml. It ignores wall thickness, so it is only ever shown as approximate. */
export function estimateCapacityMl(size: ItemSize, baseScale = 1): number | null {
  const { shape, heightMm } = size;
  if (shape === "FLAT" || !heightMm) return null;
  if (shape === "ROUND") {
    if (!size.topDiameterMm) return null;
    const top = (Math.PI * size.topDiameterMm ** 2) / 4;
    const baseDiameter = size.baseDiameterMm ?? size.topDiameterMm;
    return roundCapacity(frustum(top, (Math.PI * baseDiameter ** 2) / 4, heightMm) / 1000);
  }
  if (!size.lengthMm || !size.widthMm) return null;
  const top = size.lengthMm * size.widthMm;
  return roundCapacity(frustum(top, top * baseScale ** 2, heightMm) / 1000);
}

const capacityAmount = (ml: number) => (ml >= 1000 ? `${Number((ml / 1000).toFixed(1))} L` : `${ml} ml`);

export function formatCapacity(ml: number, isEstimate: boolean): string {
  return isEstimate ? `About ${capacityAmount(ml)}` : capacityAmount(ml);
}

/** For text baked into a photo, which every shopper sees whatever their language */
export function formatCapacityOnPhoto(ml: number, isEstimate: boolean): string {
  return isEstimate ? `~ ${capacityAmount(ml)}` : capacityAmount(ml);
}
