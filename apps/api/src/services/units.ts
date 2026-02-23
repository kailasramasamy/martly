const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  GRAM: "g",
  LITER: "L",
  ML: "ml",
  PIECE: "pcs",
  PACK: "pack",
  DOZEN: "doz",
  BUNDLE: "bundle",
};

export function formatUnitType(unitType: string): string {
  return UNIT_LABELS[unitType] ?? unitType.toLowerCase();
}

/** Format unitType on a single variant object */
export function formatVariantUnit<T extends { unitType: string }>(variant: T): T {
  return { ...variant, unitType: formatUnitType(variant.unitType) };
}

/** Format unitType on an array of variants */
export function formatVariantUnits<T extends { unitType: string }>(variants: T[]): T[] {
  return variants.map(formatVariantUnit);
}
