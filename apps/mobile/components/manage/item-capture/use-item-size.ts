import { useMemo, useState } from "react";
import { estimateCapacityMl, formatCapacity, NEEDED_ITEM_SIZES, type ItemSize } from "@martly/shared/item-size";
import type { ItemCapture } from "../../../modules/item-measure";

export type ShapeValue = ItemSize["shape"];

const toCm = (mm?: number) => (mm ? String(Math.round(mm / 5) / 2) : "");
const toMm = (cm: string) => {
  const value = Number(cm.replace(/,/g, "."));
  return value > 0 ? Math.round(value * 10) : undefined;
};

const emptySizes = { length: "", width: "", height: "", topDiameter: "", baseDiameter: "" };
type Sizes = typeof emptySizes;

const fieldOf = (mmField: (typeof NEEDED_ITEM_SIZES)[ShapeValue][number]) => mmField.replace("Mm", "") as keyof Sizes;

/** Keeps the phone's exact reading unless a field was edited, so calibration can tell a correction from rounding */
function resolved(text: string, reading: number | undefined) {
  return text === toCm(reading) ? reading : toMm(text);
}

/** The item's size in cm as staff see it, starting from the phone's reading when there is one */
export function useItemSize() {
  const [shape, setShape] = useState<ShapeValue>("ROUND");
  const [sizes, setSizes] = useState<Sizes>(emptySizes);
  const [capacity, setCapacity] = useState("");
  const [showCapacityOnPhoto, setShowCapacityOnPhoto] = useState(false);
  const [reading, setReading] = useState<ItemCapture | null>(null);

  const load = (next: ItemCapture) => {
    setReading(next);
    setShape(next.shape);
    setCapacity("");
    setShowCapacityOnPhoto(false);
    setSizes({
      length: toCm(next.lengthMm), width: toCm(next.widthMm), height: toCm(next.heightMm),
      topDiameter: toCm(next.topDiameterMm), baseDiameter: toCm(next.baseDiameterMm),
    });
  };

  const reset = () => {
    setReading(null);
    setShape("ROUND");
    setSizes(emptySizes);
    setCapacity("");
    setShowCapacityOnPhoto(false);
  };

  const size = useMemo<ItemSize>(() => {
    const has = (key: keyof Sizes) => shape === "ROUND"
      ? key === "topDiameter" || key === "baseDiameter" || key === "height"
      : key === "length" || key === "width" || (shape === "BOX" && key === "height");
    return {
      shape,
      lengthMm: has("length") ? resolved(sizes.length, reading?.lengthMm) : undefined,
      widthMm: has("width") ? resolved(sizes.width, reading?.widthMm) : undefined,
      heightMm: has("height") ? resolved(sizes.height, reading?.heightMm) : undefined,
      topDiameterMm: has("topDiameter") ? resolved(sizes.topDiameter, reading?.topDiameterMm) : undefined,
      baseDiameterMm: has("baseDiameter") ? resolved(sizes.baseDiameter, reading?.baseDiameterMm) : undefined,
    };
  }, [shape, sizes, reading]);

  const set = (key: keyof Sizes) => (text: string) => setSizes((prev) => ({ ...prev, [key]: text }));
  const valid = NEEDED_ITEM_SIZES[shape].every((field) => toMm(sizes[fieldOf(field)]));

  const capacityMl = Number(capacity);
  const estimate = shape === reading?.shape ? estimateCapacityMl(size, reading.baseScale) : estimateCapacityMl(size);
  const estimateText = estimate ? formatCapacity(estimate, true) : null;
  const capacityError = capacity && !(Number.isInteger(capacityMl) && capacityMl > 0) ? "Whole number of ml" : null;

  const payload = () => {
    const { photos: _photos, ...details } = reading ?? {};
    return {
      ...size,
      showCapacityOnPhoto: shape !== "FLAT" && showCapacityOnPhoto,
      ...(capacity ? { markedCapacityMl: capacityMl } : {}),
      ...(reading ? { reading: details } : {}),
    };
  };

  return { shape, setShape, sizes, set, capacity, setCapacity, capacityError, estimateText, showCapacityOnPhoto, setShowCapacityOnPhoto, reading, load, reset, valid: valid && !capacityError, payload };
}
