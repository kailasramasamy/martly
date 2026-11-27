/**
 * Sets HSN code and GST rate on master-catalog products from the reviewed aisle map in prisma/data/subcategory-hsn-gst.json.
 * Each aisle has a default and optional overrides (product-name regex, or unbranded = loose goods). Rates follow CBIC
 * 9/2025-CT(Rate) and 10/2025-CT(Rate) as amended (consolidated chart up to 31.03.2026, plus 01/2026 for beverages).
 *
 *   cd apps/api && npx tsx prisma/seed-hsn-gst.ts [--csv out.csv] [--apply] [--overwrite]
 *
 * Without --apply it only reports. Products that already have an HSN code are left alone unless --overwrite is given.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";

interface Rate { hsn: string; gst: number; source: string }
interface Override extends Rate { nameRegex?: string; unbranded?: boolean }
interface Aisle extends Rate { overrides?: Override[] }

const argv = process.argv.slice(2);
const csvPath = argv.includes("--csv") ? argv[argv.indexOf("--csv") + 1] : null;
const apply = argv.includes("--apply");
const overwrite = argv.includes("--overwrite");

const prisma = new PrismaClient();
const aisles = JSON.parse(readFileSync("prisma/data/subcategory-hsn-gst.json", "utf8")) as Record<string, Aisle>;
const patterns = new Map<string, RegExp>();
const regex = (source: string) => patterns.get(source) ?? patterns.set(source, new RegExp(source, "i")).get(source)!;

/** The first override that fits the product, else the aisle default */
function rateFor(aisle: Aisle, name: string, branded: boolean): Rate {
  const hit = aisle.overrides?.find((o) =>
    (o.unbranded === undefined || o.unbranded === !branded) && (!o.nameRegex || regex(o.nameRegex).test(name)));
  return hit ?? aisle;
}

const products = await prisma.product.findMany({
  where: { organizationId: null, isActive: true },
  select: { id: true, name: true, brandId: true, hsnCode: true, gstPercent: true, subcategory: { select: { slug: true, name: true } } },
});

const rows = products.map((p) => {
  const aisle = p.subcategory ? aisles[p.subcategory.slug] : undefined;
  const rate = aisle ? rateFor(aisle, p.name, p.brandId !== null) : null;
  return { p, rate };
});

const unmapped = rows.filter((r) => !r.rate);
const todo = rows.filter((r) => r.rate && (overwrite || !r.p.hsnCode));
const byRate = todo.reduce<Record<string, number>>((n, r) => ({ ...n, [`${r.rate!.gst}%`]: (n[`${r.rate!.gst}%`] ?? 0) + 1 }), {});
console.log(`${products.length} master products; ${todo.length} to set ${JSON.stringify(byRate)}; ${unmapped.length} in aisles with no map`);
for (const slug of new Set(unmapped.map((r) => r.p.subcategory?.slug ?? "(no aisle)"))) console.log(`  unmapped aisle: ${slug}`);

if (csvPath) {
  const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const lines = rows.filter((r) => r.rate).map(({ p, rate }) =>
    [p.id, p.name, p.subcategory!.name, p.brandId ? "branded" : "unbranded", rate!.hsn, rate!.gst, rate!.source].map(cell).join(","));
  writeFileSync(csvPath, ["id,name,aisle,brand,hsn,gst,source", ...lines].join("\n") + "\n");
  console.log(`Wrote ${lines.length} rows to ${csvPath}`);
}

if (apply) {
  for (let i = 0; i < todo.length; i += 1000) {
    const batch = todo.slice(i, i + 1000);
    await prisma.$executeRaw`
      update products p set hsn_code = v.hsn, gst_percent = v.gst::numeric, updated_at = now()
      from unnest(${batch.map((r) => r.p.id)}::text[], ${batch.map((r) => r.rate!.hsn)}::text[], ${batch.map((r) => String(r.rate!.gst))}::text[])
        as v(id, hsn, gst)
      where p.id = v.id`;
  }
  console.log(`Updated ${todo.length} products`);
}
await prisma.$disconnect();
