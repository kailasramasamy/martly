// Formatted variant units (kg, g, L, ml) to grams / millilitres
const TO_BASE: Record<string, { factor: number; base: "g" | "ml" }> = {
  g: { factor: 1, base: "g" },
  kg: { factor: 1000, base: "g" },
  ml: { factor: 1, base: "ml" },
  L: { factor: 1000, base: "ml" },
};
const PER = 100;

/** "₹14.2/100 g" so packs of different sizes compare at a glance; null for pieces or a 100 g pack itself. */
export function unitPriceLabel(price: number, variant: { unitType: string; unitValue: string }): string | null {
  const unit = TO_BASE[variant.unitType];
  const amount = Number(variant.unitValue) * (unit?.factor ?? 0);
  if (!unit || !(amount > 0) || amount === PER || !(price > 0)) return null;
  const per = (price / amount) * PER;
  return `\u20B9${per < 10 ? per.toFixed(2) : per.toFixed(1)}/${PER} ${unit.base}`;
}
