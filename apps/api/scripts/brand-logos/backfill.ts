/**
 * Backfill Brand.imageUrl with each brand's real logo (from its official website), hosted on our S3.
 *
 * Usage: cd apps/api && npx tsx scripts/brand-logos/backfill.ts <step> [--limit 150] [--only "A,B"] [--retry-failed] [--dry-run]
 * Steps: domains | fetch | sheet | apply | all (domains+fetch+sheet)
 * Review the contact sheets in out/, then put bad brands in overrides.json as null
 * (or pin a domain: { "<brand name>": "<domain>" | null }) and re-run fetch --only "<names>".
 */

import { applyLogos } from "./apply.js";
import { loadOverrides, prisma, readJson, topBrands, DomainEntry, FetchEntry, writeJson } from "./common.js";
import { buildSheets } from "./contact-sheet.js";
import { fetchLogos } from "./fetch-logos.js";
import { findDomains } from "./find-domains.js";

const args = process.argv.slice(2);
const step = args[0];
const flag = (name: string) => args[args.indexOf(name) + 1];
const LIMIT = Number(flag("--limit")) || 150;
const DRY_RUN = args.includes("--dry-run");
const ONLY = new Set((flag("--only") ?? "").split(",").filter(Boolean));

async function runDomains() {
  const domains = await findDomains(await topBrands(LIMIT), loadOverrides());
  console.log(`brands: ${domains.length}, domains found: ${domains.filter((d) => d.domain).length}`);
}

async function runFetch() {
  const domains = readJson<DomainEntry[]>("domains.json", []).map((d) => {
    const overrides = loadOverrides();
    return d.name in overrides ? { ...d, domain: overrides[d.name] } : d;
  });
  const entries = await fetchLogos(domains, ONLY, args.includes("--retry-failed"));
  const brands = (await topBrands(LIMIT)).length;
  writeJson("report.json", entries);
  console.log(`brands: ${brands}, logos fetched: ${entries.filter((e) => e.file).length}`);
}

async function runSheet() {
  const paths = await buildSheets(readJson<FetchEntry[]>("fetch.json", []));
  console.log(paths.join("\n"));
}

async function runApply() {
  const entries = readJson<FetchEntry[]>("fetch.json", []);
  const count = await applyLogos(entries, loadOverrides(), DRY_RUN);
  console.log(`${DRY_RUN ? "would apply" : "applied"}: ${count}`);
}

const STEPS: Record<string, () => Promise<void>> = {
  domains: runDomains,
  fetch: runFetch,
  sheet: runSheet,
  apply: runApply,
  all: async () => {
    await runDomains();
    await runFetch();
    await runSheet();
  },
};

async function main() {
  const run = STEPS[step];
  if (!run) throw new Error(`Unknown step "${step}". Use: ${Object.keys(STEPS).join(" | ")}`);
  await run();
}

main().finally(() => prisma.$disconnect());
