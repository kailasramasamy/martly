export type BaseUnit = "g" | "ml" | "pcs" | "pack";

export interface PackSize {
  unit: BaseUnit;
  amount: number;
}

/** What a list line asked for, as parsed: an amount in a base unit, a money's worth, or neither */
export interface Want {
  amount: number | null;
  unit: BaseUnit | null;
  rupees: number | null;
}

export interface PackOption {
  size: PackSize;
  price: number;
}

// Formatted variant unit labels (services/units.ts) → base unit and multiplier
const UNIT_BASE: Record<string, { unit: BaseUnit; factor: number }> = {
  kg: { unit: "g", factor: 1000 },
  g: { unit: "g", factor: 1 },
  L: { unit: "ml", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  pcs: { unit: "pcs", factor: 1 },
  doz: { unit: "pcs", factor: 12 },
  pack: { unit: "pack", factor: 1 },
  bundle: { unit: "pack", factor: 1 },
};

// An exact amount in more packs than this loses to one pack that covers it ("kaal kilo chilli powder" isn't 5 × 50 g)
const FEW_PACKS = 4;
// Never more packs than this of one size (1.2 kg isn't 12 × 100 g)
const MAX_PACKS = 10;

export function packSize(unitLabel: string, unitValue: number): PackSize {
  const base = UNIT_BASE[unitLabel] ?? { unit: "pack", factor: 1 };
  return { unit: base.unit, amount: unitValue * base.factor };
}

/** Packs of one size for an amount: how many, and how much over the amount they come to */
type Fit = { index: number; amount: number; packs: number; over: number };

/** The size and count for an amount in the line's unit, from sizes measured in that unit */
function fitAmount(sized: { index: number; amount: number }[], want: number): Fit {
  const fits = sized.map((o) => {
    const packs = Math.ceil(want / o.amount);
    return { index: o.index, amount: o.amount, packs, over: packs * o.amount - want };
  });
  const exact = fits.filter((f) => f.over === 0).sort((a, b) => b.amount - a.amount);
  const fewExact = exact.find((f) => f.packs <= FEW_PACKS);
  if (fewExact) return fewExact;
  const covering = fits.filter((f) => f.packs === 1).sort((a, b) => a.amount - b.amount)[0];
  if (covering) return covering;
  const bounded = fits.filter((f) => f.packs <= MAX_PACKS).sort((a, b) => a.over - b.over || a.packs - b.packs);
  return bounded[0] ?? fits.sort((a, b) => b.amount - a.amount)[0];
}

/**
 * Which pack and how many cover what was asked. `preferred` is the option bought before (-1 if none): it wins when
 * the line gives no amount. A money's worth buys that much of the cheapest pack. A weight or volume prefers the exact
 * amount in a few packs, then one pack that covers it, then the exact amount, then the least over (fewer packs on a
 * tie), never more than ten packs: 5 kg from 1 kg and 2 kg packs is 5 × 1 kg, not 3 × 2 kg.
 */
export function pickPack(options: PackOption[], want: Want, preferred: number): { index: number; quantity: number } {
  const cheapest = options.reduce((best, o, i) => (o.price < options[best].price ? i : best), 0);
  const usual = preferred >= 0 ? preferred : cheapest;
  if (want.rupees !== null) {
    return { index: cheapest, quantity: Math.max(1, Math.round(want.rupees / options[cheapest].price)) };
  }
  if (want.amount === null || want.unit === null) return { index: usual, quantity: 1 };

  const count = Math.max(1, Math.round(want.amount));
  const sized = options
    .map((o, index) => ({ index, amount: o.size.amount, unit: o.size.unit }))
    .filter((o) => o.unit === want.unit && o.amount > 0);
  if (want.unit === "pack" || sized.length === 0) {
    return { index: usual, quantity: want.unit === "pack" || want.unit === "pcs" ? count : 1 };
  }
  const fit = fitAmount(sized, want.amount);
  return { index: fit.index, quantity: fit.packs };
}
