/**
 * Cuts each product's photo out of its background, trimmed to the pack, so packs can stand on Walk the store's shelves
 * (docs/store-walk-realism.md). One cut-out per product, shared by every store; the original photo stays as it is.
 * - A photo already transparent at its corners (the F&V cutouts) is its own cut-out.
 * - A pack on white: the white is flood-filled away from the photo's edges. A pale pack, which the fill could run into,
 *   is cut by rembg's birefnet-general instead (set up as in the clean-logo skill; ~60 s an image on this Mac).
 * - Anything else (a pack in a styled scene) keeps no cut-out and is listed at the end.
 * Products with a pack render are skipped, as their render is already cut tight.
 * --flood-only leaves the packs the model would cut for a later run, so a whole catalog gets its quick cut-outs first.
 * --remote <url> shares the model's work with another computer running `rembg s --host 0.0.0.0 --port 7100`
 *   (repeatable); each takes the next batch as it finishes one. --remote-only keeps the model off this computer.
 * Run: npx tsx prisma/generate-cutouts.ts --category "Atta & Flours" [--category …] [--store <id>] [--limit N] [--force]
 *      [--flood-only] [--remote http://192.168.1.20:7100] [--remote-only] (point DATABASE_URL at the target DB)
 */
import dotenv from "dotenv";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const { putObject } = await import("../src/services/media.js");

const prisma = new PrismaClient();
const REMBG = process.env.REMBG_BIN ?? join(homedir(), ".venvs/rembg-312/bin/rembg");
const MODEL = "birefnet-general";
const BATCH = 40;
// Three times the tallest pack on a shelf
const LONGEST = 480;
// A pixel this light on every channel is the photo's white background
const WHITE = 238;
// A pack on white: this share of the photo's edge is white
const WHITE_EDGE = 0.9;
// Edge pixels lighter than this fade out, so no white fringe shows on a dark shelf
const FRINGE = 200;
// An outline pixel this light is pale; more than this share of pale outline sends the pack to the model
const PALE = 215;
const MAX_PALE = 0.25;
const INSET = 3;
// A notch deeper than this share of the pack's size is the fill biting into it
const MAX_NOTCH = 0.1;
// The model's cut must keep this share of the photo's non-white pixels (a pale pack read as background fails it)
const MIN_KEPT = 0.85;
// How many times to try another computer, and how long to wait between tries
const REMOTE_TRIES = 4;
const REMOTE_RETRY_MS = 15_000;

type Job = { id: string; name: string; imageUrl: string };
type Raw = { data: Buffer; width: number; height: number };

type Outcome = "cut" | "reused" | "model" | "deferred" | "scene" | "failed";
// Runs the model over every photo in one folder, writing each cut-out under the same name in the other
type Cutter = (input: string, output: string) => Promise<void>;

function args() {
  const argv = process.argv.slice(2);
  const values = (flag: string) => argv.flatMap((a, i) => (a === flag && argv[i + 1] ? [argv[i + 1]] : []));
  const limit = Number(values("--limit")[0]);
  return {
    categories: values("--category"), storeId: values("--store")[0], force: argv.includes("--force"),
    floodOnly: argv.includes("--flood-only"), remoteOnly: argv.includes("--remote-only"), remotes: values("--remote"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
  };
}

function products({ categories, storeId, force, limit }: ReturnType<typeof args>) {
  return prisma.product.findMany({
    where: {
      isActive: true, imageUrl: { not: null }, packPhotoUrl: null,
      ...(force ? {} : { cutoutUrl: null }),
      ...(categories.length ? { subcategory: { category: { name: { in: categories } } } } : {}),
      ...(storeId ? { storeProducts: { some: { storeId, isActive: true } } } : {}),
    },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: "asc" },
    take: limit,
  }) as Promise<Job[]>;
}

async function rgba(image: Buffer): Promise<Raw> {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const isWhite = ({ data }: Raw, p: number) => data[p * 4] >= WHITE && data[p * 4 + 1] >= WHITE && data[p * 4 + 2] >= WHITE;

function edgePixels({ width, height }: Raw) {
  const edge: number[] = [];
  for (let x = 0; x < width; x++) edge.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) edge.push(y * width, y * width + width - 1);
  return edge;
}

const isCutAlready = (raw: Raw) => edgePixels(raw).every((p) => raw.data[p * 4 + 3] < 16);

/** The white joined to the photo's edges: 1 where it's background */
function floodWhite(raw: Raw) {
  const { width, height } = raw;
  const background = new Uint8Array(width * height);
  const queue = edgePixels(raw).filter((p) => isWhite(raw, p));
  for (const p of queue) background[p] = 1;
  while (queue.length) {
    const p = queue.pop()!;
    const x = p % width;
    for (const n of [p - width, p + width, x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1]) {
      if (n >= 0 && n < width * height && !background[n] && isWhite(raw, n)) {
        background[n] = 1;
        queue.push(n);
      }
    }
  }
  return background;
}

/** Clears the background, and fades the pale pixels along its edge so the pack has no white fringe */
function clearBackground(raw: Raw, background: Uint8Array) {
  const { data, width } = raw;
  const out = Buffer.from(data);
  for (let p = 0; p < background.length; p++) {
    if (background[p]) { out[p * 4 + 3] = 0; continue; }
    const x = p % width;
    const touches = [p - width, p + width, x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1].some((n) => n >= 0 && background[n]);
    const light = Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    if (touches && light > FRINGE) out[p * 4 + 3] = Math.round((255 * (255 - light)) / (255 - FRINGE));
  }
  return { ...raw, data: out };
}

// The share of the pack's outline that is near-white: there the flood fill may have run into a pale pack, so the model
// cuts it instead (a coloured pack's outline stops the fill at its true edge)
// The outline itself blends into the white, so it's read a few pixels in, past the blend
function paleOutline({ data, width }: Raw, background: Uint8Array) {
  const depth = new Uint8Array(background.length);
  let ring: number[] = [];
  for (let p = 0; p < background.length; p++) if (background[p]) ring.push(p);
  for (let d = 1; d <= INSET; d++) {
    const next: number[] = [];
    for (const p of ring) {
      const x = p % width;
      for (const n of [p - width, p + width, x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1]) {
        if (n >= 0 && n < background.length && !background[n] && !depth[n]) { depth[n] = d; next.push(n); }
      }
    }
    ring = next;
  }
  const pale = ring.filter((p) => Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) >= PALE).length;
  return ring.length ? pale / ring.length : 1;
}

type Point = [number, number];

// The pack's outline as seen from outside: its first and last pixel on each row and each column
function outlinePoints(background: Uint8Array, width: number, height: number) {
  const points: Point[] = [];
  const solid = (x: number, y: number) => !background[y * width + x];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width && !solid(x, y)) x++;
    if (x === width) continue;
    let right = width - 1;
    while (!solid(right, y)) right--;
    points.push([x, y], [right, y]);
  }
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height && !solid(x, y)) y++;
    if (y === height) continue;
    let bottom = height - 1;
    while (!solid(x, bottom)) bottom--;
    points.push([x, y], [x, bottom]);
  }
  return points;
}

// Monotone chain
function convexHull(points: Point[]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

function segmentDistance([px, py]: Point, [ax, ay]: Point, [bx, by]: Point) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// How deep the pack's outline dips in from its convex hull, as a share of its size. A pack's own outline is near
// convex; the fill running into a white band on the pack bites a deep notch out of it, so the model cuts it instead
function notchDepth(background: Uint8Array, width: number, height: number) {
  const points = outlinePoints(background, width, height);
  if (points.length < 3) return 1;
  const hull = convexHull(points);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  let deepest = 0;
  for (const p of points) {
    let near = Infinity;
    for (let i = 0; i < hull.length; i++) near = Math.min(near, segmentDistance(p, hull[i], hull[(i + 1) % hull.length]));
    deepest = Math.max(deepest, near);
  }
  return deepest / size;
}

// How much of the photo's non-white the model's cut kept
function keptShare(original: Raw, cut: Raw) {
  let solid = 0;
  let kept = 0;
  for (let p = 0; p < original.width * original.height; p++) {
    if (isWhite(original, p)) continue;
    solid++;
    if (cut.data[p * 4 + 3] > 128) kept++;
  }
  return solid ? kept / solid : 0;
}

async function save(job: Job, cut: Raw) {
  const image = await sharp(cut.data, { raw: { width: cut.width, height: cut.height, channels: 4 } })
    .trim().resize(LONGEST, LONGEST, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 }).toBuffer();
  const { url } = await putObject(`cutouts/${job.id}-${randomUUID().slice(0, 8)}.webp`, image, "image/webp");
  await prisma.product.update({ where: { id: job.id }, data: { cutoutUrl: url } });
}

/** Flood-fills a pack on white; a photo already cut is used as it is. Returns what's left for the model */
async function cutOne(job: Job, modelDir: string): Promise<Outcome | Raw> {
  const res = await fetch(job.imageUrl);
  if (!res.ok) return "failed";
  const image = Buffer.from(await res.arrayBuffer());
  const raw = await rgba(image);
  if (isCutAlready(raw)) {
    await prisma.product.update({ where: { id: job.id }, data: { cutoutUrl: job.imageUrl } });
    return "reused";
  }
  if (edgePixels(raw).filter((p) => isWhite(raw, p)).length < edgePixels(raw).length * WHITE_EDGE) return "scene";
  const background = floodWhite(raw);
  const cut = clearBackground(raw, background);
  if (paleOutline(raw, background) <= MAX_PALE && notchDepth(background, raw.width, raw.height) <= MAX_NOTCH) {
    await save(job, cut);
    return "cut";
  }
  await writeFile(join(modelDir, `${job.id}.png`), await sharp(image).png().toBuffer());
  return raw;
}

const localCutter: Cutter = async (input, output) => {
  await promisify(execFile)(REMBG, ["p", "-m", MODEL, input, output], { maxBuffer: 1 << 24 });
};

// A dropped connection gets another try before the computer is given up on
async function postCut(base: string, form: FormData) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${base}/api/remove`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`${base} answered ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      // fetch reports a dropped connection as a TypeError, with the reason in its cause
      if (!(e instanceof TypeError) || attempt === REMOTE_TRIES) throw e;
      console.error(`${base}: ${(e.cause as Error | undefined)?.message ?? e.message}, trying again`);
      await new Promise((resolve) => setTimeout(resolve, REMOTE_RETRY_MS));
    }
  }
}

function remoteCutter(base: string): Cutter {
  return async (input, output) => {
    for (const file of await readdir(input)) {
      const form = new FormData();
      form.append("file", new Blob([await readFile(join(input, file))]), file);
      form.append("model", MODEL);
      await writeFile(join(output, file), await postCut(base, form));
    }
  };
}

/** The packs the flood fill leaked into, cut by the model; returns the ids that pass */
async function modelCut(leaked: Map<string, { job: Job; raw: Raw }>, work: string, cutter: Cutter) {
  const input = join(work, "in");
  const output = join(work, "out");
  await mkdir(output, { recursive: true });
  await cutter(input, output);
  const passed = new Set<string>();
  for (const [id, { job, raw }] of leaked) {
    const cut = await rgba(await sharp(join(output, `${id}.png`)).resize(raw.width, raw.height).toBuffer());
    if (keptShare(raw, cut) < MIN_KEPT) continue;
    await save(job, cut);
    passed.add(id);
  }
  return passed;
}

// A product left without a cut-out loses any earlier one (a --force run), so a bad old cut never lingers
async function cutBatch(jobs: Job[], work: string, tally: Record<Outcome, Job[]>, cutter: Cutter | null) {
  const input = join(work, "in");
  await mkdir(input, { recursive: true });
  const outcomes = new Map<string, Outcome>();
  const leaked = new Map<string, { job: Job; raw: Raw }>();
  await Promise.all(jobs.map(async (job) => {
    const outcome = await cutOne(job, input).catch((e) => { console.error(`${job.name}: ${e.message}`); return "failed" as const; });
    if (typeof outcome === "string") outcomes.set(job.id, outcome);
    else leaked.set(job.id, { job, raw: outcome });
  }));
  const passed = leaked.size && cutter ? await modelCut(leaked, work, cutter) : new Set<string>();
  for (const id of leaked.keys()) outcomes.set(id, !cutter ? "deferred" : passed.has(id) ? "model" : "failed");
  for (const job of jobs) tally[outcomes.get(job.id)!].push(job);
  const uncut = jobs.filter((job) => ["scene", "failed"].includes(outcomes.get(job.id)!)).map((job) => job.id);
  await prisma.product.updateMany({ where: { id: { in: uncut }, cutoutUrl: { not: null } }, data: { cutoutUrl: null } });
}

async function main() {
  const options = args();
  const jobs = await products(options);
  console.log(`${jobs.length} products to cut`);
  const tally: Record<Outcome, Job[]> = { cut: [], reused: [], model: [], deferred: [], scene: [], failed: [] };
  const cutters = options.floodOnly ? [null] : [...(options.remoteOnly ? [] : [localCutter]), ...options.remotes.map(remoteCutter)];
  let next = 0;
  // Each cutter takes the next batch as soon as it's done with one, so a faster computer takes more of them
  await Promise.all(cutters.map(async (cutter) => {
    while (next < jobs.length) {
      const batch = jobs.slice(next, (next += BATCH));
      const work = await mkdtemp(join(tmpdir(), "cutouts-"));
      try {
        await cutBatch(batch, work, tally, cutter);
      } catch (e) {
        // A computer that drops off the network stops taking batches; its batch is picked up by the next run
        console.error(`stopped a cutter: ${(e as Error).message}`);
        return;
      } finally {
        await rm(work, { recursive: true, force: true });
      }
      const done = Object.values(tally).reduce((n, v) => n + v.length, 0);
      console.log(`${done}/${jobs.length}: ${Object.entries(tally).map(([k, v]) => `${v.length} ${k}`).join(", ")}`);
    }
  }));
  for (const job of tally.scene) console.log(`scene, no cut-out: ${job.name} (${job.id})`);
  for (const job of tally.failed) console.log(`failed: ${job.name} (${job.id})`);
}

main().finally(() => prisma.$disconnect());
