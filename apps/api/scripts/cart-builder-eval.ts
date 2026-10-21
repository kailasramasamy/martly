/**
 * Cart builder eval: builds 200 shopping lists (100 Tamil, 50 Tanglish, 50 English) from labelled staples, runs each
 * through the parse + match pipeline against one store, and reports how often lines split right and the top product
 * lands in the expected subcategory. Calls Claude once per list (Haiku 5.5, a few cents in all); writes no runs.
 *
 * Usage: npx tsx scripts/cart-builder-eval.ts [storeId] [listCount]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";
import { matchLines } from "../src/services/cart-builder/match.js";
import { parseList } from "../src/services/cart-builder/parse.js";
import { glossaryPrompt, storeLanguages } from "../src/services/cart-builder/glossary.js";

type Lang = "ta" | "tg" | "en";
interface Item { ta: string; tg: string; en: string; expect: string[] }

const HARUR_FRESH_MART = "66dd70fc-98e0-4120-bf7f-13723eaad571";
const storeId = process.argv[2] ?? HARUR_FRESH_MART;
const listCount = Number(process.argv[3] ?? 200);
// Lists at once; each searches up to 5 lines at once, to stay inside the connection pool
const PARALLEL = 2;
const JOINERS: Record<Lang, string[]> = { ta: ["\n", ", ", " அப்புறம் "], tg: [", ", " apram ", " and "], en: [", ", "\n", " and "] };
const items: Item[] = JSON.parse(readFileSync(new URL("./cart-builder-eval/items.json", import.meta.url), "utf8"));
const prisma = new PrismaClient();

// Seeded so every run scores the same lists
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLists() {
  const next = random(42);
  return Array.from({ length: listCount }, (_, i) => {
    const lang: Lang = i % 2 === 0 ? "ta" : i % 4 === 1 ? "tg" : "en";
    const picked = [...items].sort(() => next() - 0.5).slice(0, 4 + Math.floor(next() * 7));
    const join = JOINERS[lang][Math.floor(next() * 3)];
    return { lang, items: picked, text: picked.map((it) => it[lang]).join(join) };
  });
}

async function scoreList(list: ReturnType<typeof makeLists>[number], glossary: string) {
  const t0 = Date.now();
  const parsed = await parseList(list.text, glossary);
  const parseMs = Date.now() - t0;
  const matched = await matchLines(prisma, storeId, parsed.lines, new Map());
  const splitOk = parsed.lines.length === list.items.length;
  const right = splitOk
    ? matched.map((m, i) => {
      const slug = m.candidates[0]?.storeProduct.product.subcategory?.slug ?? "";
      return list.items[i].expect.some((e) => slug.includes(e));
    })
    : list.items.map(() => false);
  return { list, matched, splitOk, right, parseMs, matchMs: Date.now() - t0 - parseMs, tokens: parsed.inputTokens + parsed.outputTokens, inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens };
}

function report(results: Awaited<ReturnType<typeof scoreList>>[]) {
  const pct = (a: number, b: number) => `${((100 * a) / Math.max(b, 1)).toFixed(1)}%`;
  const lines = results.flatMap((r) => r.right.map((ok, i) => ({ ok, lang: r.list.lang, confidence: r.splitOk ? r.matched[i].confidence : "SPLIT" })));
  console.log(`\nLists: ${results.length}, split right: ${pct(results.filter((r) => r.splitOk).length, results.length)}`);
  console.log(`Lines: ${lines.length}, right subcategory: ${pct(lines.filter((l) => l.ok).length, lines.length)}`);
  for (const lang of ["ta", "tg", "en"] as const) {
    const of = lines.filter((l) => l.lang === lang);
    console.log(`  ${lang}: ${pct(of.filter((l) => l.ok).length, of.length)} of ${of.length}`);
  }
  for (const c of ["MATCHED", "PICK", "NOT_FOUND", "SPLIT"]) {
    const of = lines.filter((l) => l.confidence === c);
    console.log(`  ${c}: ${of.length} lines, ${pct(of.filter((l) => l.ok).length, of.length)} right`);
  }
  const avg = (f: (r: (typeof results)[number]) => number) => Math.round(results.reduce((s, r) => s + f(r), 0) / results.length);
  console.log(`Avg parse ${avg((r) => r.parseMs)} ms, match ${avg((r) => r.matchMs)} ms`);
  const usd = results.reduce((s, r) => s + r.inputTokens * 0.1e-6 + r.outputTokens * 0.5e-6, 0);
  console.log(`Claude cost: $${usd.toFixed(4)} total, $${(usd / results.length).toFixed(5)} per list`);
  console.log("\nMisses:");
  for (const r of results) {
    if (!r.splitOk) { console.log(`  [split ${r.matched.length}/${r.list.items.length}] ${r.list.text.replace(/\n/g, " / ")}`); continue; }
    r.right.forEach((ok, i) => {
      if (!ok) console.log(`  [${r.matched[i].confidence}] ${r.list.items[i][r.list.lang]} → ${r.matched[i].candidates[0]?.storeProduct.product.name ?? "nothing"}`);
    });
  }
}

const lists = makeLists();
// The store's glossary, as the API reads its lists with
const glossary = await glossaryPrompt(prisma, await storeLanguages(prisma, storeId));
const results = [];
for (let i = 0; i < lists.length; i += PARALLEL) {
  results.push(...await Promise.all(lists.slice(i, i + PARALLEL).map((list) => scoreList(list, glossary))));
  process.stdout.write(`\r${results.length}/${lists.length}`);
}
report(results);
await prisma.$disconnect();
