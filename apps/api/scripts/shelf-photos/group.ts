/**
 * Step 1 of the shelf-photo import: reads every photo with Haiku and proposes which consecutive photos are one product.
 * Writes reads.json (one entry per photo, safe to re-run) and groups.json into the run folder. Nothing leaves this computer
 * except the photos sent to Anthropic. See docs/shelf-photo-import.md.
 *
 *   npx tsx scripts/shelf-photos/group.ts --photos ~/Downloads/psb-products-2026-11-02/105APPLE --run ~/Downloads/psb-products-2026-11-02/run
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

dotenv.config({ override: true });
const { imageBlock } = await import("../../src/services/catalog-agent/photos.js");
const { MODEL } = await import("../../src/services/catalog-agent/extract.js");

const run = promisify(execFile);
const CONCURRENCY = 6;
const PREVIEW_EDGE = 1536;
const WINDOW = 80;

const PhotoRead = z.object({
  isProduct: z.boolean().describe("False if no packaged product is the subject"),
  role: z.enum(["front", "back", "side", "top_bottom", "other"]),
  brand: z.string().nullable(),
  product: z.string().nullable().describe("Product name and variety as printed, without the pack size"),
  size: z.string().nullable().describe("Pack size as printed, e.g. 500 g"),
  barcode: z.string().nullable().describe("EAN digits, only if every digit is legible"),
  look: z.string().describe("Under 12 words: pack colours and shape, to tell it from similar packs"),
});
type PhotoRead = z.infer<typeof PhotoRead>;
export interface ReadPhoto extends PhotoRead { file: string; takenAt: string }

const Grouping = z.object({
  groups: z.array(z.object({
    first: z.number().int().describe("Position of the group's first photo"),
    last: z.number().int().describe("Position of the group's last photo"),
    confidence: z.enum(["high", "medium", "low"]),
    note: z.string().describe("Why it's uncertain, else empty"),
  })),
});

const GROUP_SYSTEM = `A store visitor photographed grocery packs one product at a time, so all photos of one product are consecutive.
A product can have any number of photos: front, back, sides, and repeat shots. A new product starts when the brand, product,
variety or pack size changes. Packs differing only in variety or size are DIFFERENT products. A back photo often can't show the
name, so use the barcode, the time gap and its place in the sequence. Cover every position exactly once, in order.
Use medium or low confidence whenever a boundary is a judgement call, and say why.`;

class UnreadablePhoto extends Error {}

function args() {
  const argv = process.argv.slice(2);
  const value = (flag: string) => argv[argv.indexOf(flag) + 1];
  return { photos: value("--photos"), runDir: value("--run") };
}

async function takenAt(path: string) {
  const { stdout } = await run("sips", ["-g", "creation", path]);
  return stdout.match(/creation: (.+)/)?.[1] ?? "";
}

async function readPhoto(client: Anthropic, source: string, preview: string, file: string): Promise<ReadPhoto> {
  await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", "-Z", String(PREVIEW_EDGE), source, "--out", preview]);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1500,
    output_config: { format: betaZodOutputFormat(PhotoRead) },
    messages: [{ role: "user", content: [await imageBlock(readFileSync(preview)), { type: "text", text: "Read this photo of a grocery pack. Copy what is printed; use null for anything you can't read." }] }],
  });
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  if (response.stop_reason !== "end_turn") throw new UnreadablePhoto(`stopped with ${response.stop_reason}: ${text.slice(0, 120)}`);
  const parsed = PhotoRead.safeParse(JSON.parse(text));
  if (!parsed.success) throw new UnreadablePhoto(`unexpected answer: ${text.slice(0, 120)}`);
  return { ...parsed.data, file, takenAt: await takenAt(source) };
}

async function readAll(client: Anthropic, photos: string, runDir: string) {
  const path = join(runDir, "reads.json");
  const reads: Record<string, ReadPhoto> = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const files = readdirSync(photos).filter((f) => /\.(heic|jpe?g)$/i.test(f)).sort();
  const queue = files.filter((f) => !reads[f]);
  console.log(`${files.length} photos, ${queue.length} to read`);
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const file = queue.shift()!;
      try {
        reads[file] = await readPhoto(client, join(photos, file), join(runDir, "previews", file.replace(/\.(heic|jpe?g)$/i, ".jpg")), file);
        writeFileSync(path, JSON.stringify(reads, null, 1));
        if (Object.keys(reads).length % 25 === 0) console.log(`${Object.keys(reads).length}/${files.length} read`);
      } catch (err) {
        if (!(err instanceof Anthropic.APIError || err instanceof UnreadablePhoto || err instanceof SyntaxError)) throw err;
        console.error(`${file}: ${err.message} (a re-run picks it up)`);
      }
    }
  }));
  return files.filter((f) => reads[f]).map((f) => reads[f]);
}

function line(r: ReadPhoto, i: number) {
  return `${i}\t${r.takenAt.slice(11)}\t${r.isProduct ? r.role : "not a product"}\t${r.brand ?? "-"}\t${r.product ?? "-"}\t${r.size ?? "-"}\t${r.barcode ?? "-"}\t${r.look}`;
}

async function proposeWindow(client: Anthropic, photos: ReadPhoto[], offset: number) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: GROUP_SYSTEM,
    output_config: { format: betaZodOutputFormat(Grouping) },
    messages: [{ role: "user", content: `position\ttime\trole\tbrand\tproduct\tsize\tbarcode\tlook\n${photos.map((p, i) => line(p, i + offset)).join("\n")}` }],
  });
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  if (response.stop_reason !== "end_turn") throw new Error(`Grouping stopped with ${response.stop_reason} at photo ${offset}: ${text.slice(0, 200)}`);
  return Grouping.parse(JSON.parse(text)).groups;
}

/** Works through overlapping windows: a window's last group may be cut short, so the next window starts from it */
async function propose(client: Anthropic, photos: ReadPhoto[]) {
  const ranges: z.infer<typeof Grouping>["groups"] = [];
  let start = 0;
  while (start < photos.length) {
    const window = photos.slice(start, start + WINDOW);
    const found = (await proposeWindow(client, window, start)).sort((a, b) => a.first - b.first);
    const atEnd = start + WINDOW >= photos.length;
    const keep = atEnd || found.length < 2 ? found : found.slice(0, -1);
    ranges.push(...keep);
    if (atEnd) break;
    start = Math.max(start + 1, keep[keep.length - 1].last + 1);
    console.log(`grouped up to photo ${start}/${photos.length}`);
  }
  return ranges;
}

/** The model's ranges, checked to cover every photo once; a gap or overlap becomes its own low-confidence group */
function toGroups(ranges: z.infer<typeof Grouping>["groups"], photos: ReadPhoto[]) {
  const groups: { id: string; photos: string[]; main: string; confidence: string; note: string }[] = [];
  let next = 0;
  const add = (first: number, last: number, confidence: string, note: string) => {
    const members = photos.slice(first, last + 1);
    const main = members.find((p) => p.role === "front") ?? members[0];
    groups.push({ id: members[0].file.replace(/\.(heic|jpe?g)$/i, ""), photos: members.map((p) => p.file), main: main.file, confidence, note });
  };
  for (const r of [...ranges].sort((a, b) => a.first - b.first)) {
    if (r.first < next || r.last < r.first || r.last >= photos.length) continue;
    if (r.first > next) add(next, r.first - 1, "low", "Left out by the grouping pass");
    add(r.first, r.last, r.confidence, r.note);
    next = r.last + 1;
  }
  if (next < photos.length) add(next, photos.length - 1, "low", "Left out by the grouping pass");
  return groups;
}

const { photos, runDir } = args();
if (!photos || !runDir) throw new Error("--photos and --run are required");
mkdirSync(join(runDir, "previews"), { recursive: true });
const client = new Anthropic();
const reads = await readAll(client, photos, runDir);
const groups = toGroups(await propose(client, reads), reads);
const path = join(runDir, "groups.json");
if (existsSync(path)) writeFileSync(`${path}.bak`, readFileSync(path));
writeFileSync(path, JSON.stringify(groups, null, 1));
const sizes = groups.reduce<Record<number, number>>((n, g) => ({ ...n, [g.photos.length]: (n[g.photos.length] ?? 0) + 1 }), {});
console.log(`${reads.length} photos → ${groups.length} products; photos per product: ${JSON.stringify(sizes)}; not high confidence: ${groups.filter((g) => g.confidence !== "high").length}`);
