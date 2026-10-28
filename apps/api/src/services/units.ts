import { UNIT_SHORT_LABELS, type UnitType } from "@martly/shared/constants";

export function formatUnitType(unitType: string): string {
  return UNIT_SHORT_LABELS[unitType as UnitType] ?? unitType.toLowerCase();
}

/** Format unitType on a single variant object */
export function formatVariantUnit<T extends { unitType: string }>(variant: T): T {
  return { ...variant, unitType: formatUnitType(variant.unitType) };
}

/** A listing's variant as its store sells it: formatted unit, and the store's own MRP when it has one */
export function storeVariant<V extends { unitType: string; mrp: unknown }>(sp: { mrp?: unknown; variant: V }): V {
  return { ...formatVariantUnit(sp.variant), mrp: sp.mrp ?? sp.variant.mrp };
}

/** Format unitType on an array of variants */
export function formatVariantUnits<T extends { unitType: string }>(variants: T[]): T[] {
  return variants.map(formatVariantUnit);
}
