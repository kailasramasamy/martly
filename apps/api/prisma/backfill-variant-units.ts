/**
 * Backfill unitType/unitValue from variant names for variants still on the PIECE × 1 default
 * (the branded catalog was imported without units). Enables price-per-unit display.
 *   "500g", "1 L"       → GRAM 500, LITER 1
 *   "4x15g"             → GRAM 60 (multipack total)
 *   "4-pcs", "25-bags"  → PIECE 4, PIECE 25
 *   "2-packs", "1-bunch"→ PACK 2, BUNDLE 1
 * Ambiguous names (ranges like "900g-1.1kg", lengths like "5m", combos like "20g+20ml", sets/kits) are left as-is.
 *
 * Run: cd apps/api && npx tsx prisma/backfill-variant-units.ts            (dry run: prints what would change)
 *      cd apps/api && npx tsx prisma/backfill-variant-units.ts --apply    (writes)
 * Prod: prefix with DATABASE_URL=<prod url>
 */

import { PrismaClient, UnitType } from "../generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const MEASURE: Record<string, UnitType> = {
  g: "GRAM", gm: "GRAM", gms: "GRAM", kg: "KG",
  ml: "ML", l: "LITER", ltr: "LITER", litre: "LITER", liter: "LITER",
};
const COUNT_WORDS = "pc|pcs|pieces?|bags|sachets?|sticks|tablets|tabs|capsules|wipes|pads|liners|rolls?|coils|mats|cones|blades|pens|patches|slices|napkins|sheets|bars|cups|pulls|wicks";

type Unit = { unitType: UnitType; unitValue: number };

function parseUnit(raw: string): Unit | null {
  const name = raw.trim().toLowerCase();
  let m = name.match(/^([\d.]+)\s*(g|gm|gms|kg|ml|l|ltr|litre|liter)$/);
  if (m) return { unitType: MEASURE[m[2]], unitValue: Number(m[1]) };
  m = name.match(/^(\d+)\s*x\s*([\d.]+)\s*(g|kg|ml|l)$/);
  if (m) return { unitType: MEASURE[m[3]], unitValue: Number(m[1]) * Number(m[2]) };
  m = name.match(new RegExp(`^(\\d+)[-\\s]*(${COUNT_WORDS})$`));
  if (m) return { unitType: "PIECE", unitValue: Number(m[1]) };
  m = name.match(/^(\d+)[-\s]*packs?$/);
  if (m) return { unitType: "PACK", unitValue: Number(m[1]) };
  if (/^1[-\s]*bunch$/.test(name)) return { unitType: "BUNDLE", unitValue: 1 };
  return null;
}

async function main() {
  console.log(`${APPLY ? "Applying" : "Dry run"} on ${new URL(process.env.DATABASE_URL!).host}`);
  const variants = await prisma.productVariant.findMany({
    where: { unitType: "PIECE", unitValue: 1 },
    select: { id: true, name: true },
  });

  const changes = variants.flatMap((v) => {
    const unit = parseUnit(v.name);
    const unchanged = !unit || (unit.unitType === "PIECE" && unit.unitValue === 1);
    return unchanged ? [] : [{ id: v.id, name: v.name, ...unit }];
  });
  const skipped = variants.filter((v) => !parseUnit(v.name)).map((v) => v.name);

  const byType = changes.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.unitType]: (acc[c.unitType] ?? 0) + 1 }), {});
  console.log(`${variants.length} variants on PIECE × 1 → ${changes.length} to update`, byType);
  for (const c of changes.filter((_, i) => i % 150 === 0)) console.log(`  e.g. "${c.name}" → ${c.unitType} ${c.unitValue}`);
  console.log(`Left unchanged (unparsed): ${[...new Set(skipped)].join(", ")}`);

  if (!APPLY) return;
  await prisma.$transaction(changes.map((c) =>
    prisma.productVariant.update({ where: { id: c.id }, data: { unitType: c.unitType, unitValue: c.unitValue } })));
  console.log(`✔ ${changes.length} variants updated`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
