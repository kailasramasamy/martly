import type { StoreProduct } from "./types";
import { effectivePrice } from "./group-variants";

// Pack quantity in a base unit (ml or g), keyed by the API's display labels (formatUnitType)
const BASE: Record<string, [factor: number, family: "L" | "kg"]> = {
  ml: [1, "L"], L: [1000, "L"], g: [1, "kg"], kg: [1000, "kg"],
};

const baseAmount = (sp: StoreProduct) => Number(sp.variant.unitValue) * (BASE[sp.variant.unitType]?.[0] ?? 1);

function perUnit(sp: StoreProduct): { price: number; unit: "L" | "kg" } | null {
  const base = BASE[sp.variant.unitType];
  if (!base || !Number(sp.variant.unitValue)) return null;
  return { price: effectivePrice(sp) / (baseAmount(sp) / 1000), unit: base[1] };
}

// Sizes in pack order (smallest first) for the card's size chips
export function bySize(sizes: StoreProduct[]): StoreProduct[] {
  return [...sizes].sort((a, b) => baseAmount(a) - baseAmount(b));
}

// "Saves ₹18/L": how much cheaper per litre/kg this pack is than the product's smallest pack, if at least ₹1
export function packSaving(sp: StoreProduct, sizes: StoreProduct[]): string | null {
  const smallest = bySize(sizes)[0];
  if (!smallest || smallest.id === sp.id) return null;
  const own = perUnit(sp);
  const ref = perUnit(smallest);
  if (!own || !ref || own.unit !== ref.unit) return null;
  const saving = Math.round(ref.price - own.price);
  return saving >= 1 ? `Saves ₹${saving}/${own.unit}` : null;
}
