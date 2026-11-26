/**
 * Helpers for running the shelf-photo import without Claude API calls, with a Claude Code session doing the reading.
 * See .claude/skills/shelf-photo-import/SKILL.md.
 *
 *   --refs      writes ref/brands.tsv and ref/subcategories.tsv from prod (read only), for picking brand and aisle
 *   --todo N    splits the groups that have no label yet into N lists of ids, one per subagent
 *   --check     validates every products/<id>.json the session wrote; prints what's wrong and exits 1 if anything is
 *   --pairs     writes pairs/<file>.jpg for every unchecked render: the photo on the left, the render on magenta on the right,
 *               so the session can check text and transparency in one look
 *   --comments  after the render check, writes comments.json for the fix pass: failed shots with a halo, and failed main
 *               images, each with what to correct (then process.ts --no-claude --fix-comments). Shop stickers are left alone:
 *               asking the render to remove one makes it invent text in its place
 *
 *   npx tsx scripts/shelf-photos/session-files.ts --run ~/Downloads/batch-run --check
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ override: true });
const { LabelSchema } = await import("../../src/services/catalog-agent/extract.js");
const { Tamil } = await import("./schemas.js");

interface Group { id: string; photos: string[]; main: string; skip?: boolean }

const argv = process.argv.slice(2);
const value = (flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
const runDir = value("--run");
if (!runDir) throw new Error("--run is required");
const readJson = <T>(path: string) => JSON.parse(readFileSync(join(runDir, path), "utf8")) as T;
const groups = () => readJson<Group[]>("groups.json").filter((g) => !g.skip);
const hasLabel = (id: string) => existsSync(join(runDir, "products", `${id}.json`)) && !!readJson<{ label: unknown }>(`products/${id}.json`).label;

async function writeRefs() {
  const { PrismaClient } = await import("../../generated/prisma/client.js");
  const prisma = new PrismaClient({ datasourceUrl: process.env.PROD_DATABASE_URL });
  const brands = await prisma.brand.findMany({ where: { organizationId: null }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const subs = await prisma.subcategory.findMany({ select: { id: true, name: true, category: { select: { name: true, department: { select: { name: true } } } } } });
  const paths = subs.map((s) => `${s.id}\t${s.category.department.name} > ${s.category.name} > ${s.name}`).sort((a, b) => a.split("\t")[1].localeCompare(b.split("\t")[1]));
  mkdirSync(join(runDir!, "ref"), { recursive: true });
  writeFileSync(join(runDir!, "ref", "brands.tsv"), brands.map((b) => `${b.id}\t${b.name}`).join("\n") + "\n");
  writeFileSync(join(runDir!, "ref", "subcategories.tsv"), paths.join("\n") + "\n");
  console.log(`${brands.length} brands, ${paths.length} subcategories written to ${join(runDir!, "ref")}`);
  await prisma.$disconnect();
}

function splitTodo(parts: number) {
  const todo = groups().filter((g) => !hasLabel(g.id));
  const size = Math.ceil(todo.length / parts);
  for (let i = 0; i < todo.length; i += size) console.log(todo.slice(i, i + size).map((g) => g.id).join(" "));
  console.log(`${todo.length} groups without a label`);
}

function idsIn(file: string) {
  return new Set(readFileSync(join(runDir!, "ref", file), "utf8").split("\n").filter(Boolean).map((line) => line.split("\t")[0]));
}

function problems(group: Group, brandIds: Set<string>, subIds: Set<string>) {
  const product = readJson<Record<string, any>>(`products/${group.id}.json`);
  const found: string[] = [];
  const label = LabelSchema.safeParse(product.label);
  if (!label.success) found.push(`label: ${label.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  const tamil = Tamil.safeParse(product.tamil);
  if (!tamil.success) found.push(`tamil: ${tamil.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  if (label.success && tamil.success && tamil.data.nutrientNames.length !== label.data.nutrition.length) found.push("tamil.nutrientNames must match label.nutrition, row for row");
  if (product.classification?.brand && !brandIds.has(product.classification.brand.id)) found.push("classification.brand.id is not in ref/brands.tsv");
  if (!product.classification?.subcategoryId || !subIds.has(product.classification.subcategoryId)) found.push("classification.subcategoryId is not in ref/subcategories.tsv");
  if (JSON.stringify(product.photos) !== JSON.stringify(group.photos) || product.main !== group.main) found.push("photos and main must match groups.json");
  for (const key of ["shots", "existing", "barcodeTaken", "usd", "error"]) if (!(key in product)) found.push(`missing ${key}`);
  return found;
}

function check() {
  const [brandIds, subIds] = [idsIn("brands.tsv"), idsIn("subcategories.tsv")];
  let bad = 0;
  const all = groups();
  for (const group of all) {
    const found = hasLabel(group.id) ? problems(group, brandIds, subIds) : ["no label yet"];
    if (found.length) bad++, console.log(`${group.id}: ${found.join(" | ")}`);
  }
  console.log(`${all.length - bad}/${all.length} products valid`);
  if (bad) process.exitCode = 1;
}

const PAIR_EDGE = 1024;
const MAGENTA = { r: 255, g: 0, b: 255 };

async function writePairs() {
  mkdirSync(join(runDir!, "pairs"), { recursive: true });
  let made = 0;
  for (const name of readdirSync(join(runDir!, "products")).filter((f) => f.endsWith(".json"))) {
    const product = readJson<{ shots: { file: string; image: string | null; verdict: string | null }[] }>(`products/${name}`);
    for (const shot of product.shots.filter((s) => s.image && s.verdict === "unchecked")) {
      const stem = shot.file.replace(/\.[^.]+$/, "");
      const photo = await sharp(join(runDir!, "previews", `${stem}.jpg`)).resize(PAIR_EDGE, PAIR_EDGE, { fit: "contain", background: "#ffffff" }).toBuffer();
      const render = await sharp(join(runDir!, "rendered", shot.image!)).resize(PAIR_EDGE, PAIR_EDGE).flatten({ background: MAGENTA }).toBuffer();
      await sharp({ create: { width: PAIR_EDGE * 2, height: PAIR_EDGE, channels: 3, background: "#ffffff" } })
        .composite([{ input: photo, left: 0, top: 0 }, { input: render, left: PAIR_EDGE, top: 0 }]).jpeg({ quality: 85 }).toFile(join(runDir!, "pairs", `${stem}.jpg`));
      made++;
    }
  }
  console.log(`${made} pairs written to ${join(runDir!, "pairs")}`);
}

const HALO = /halo|glow|haze|artifact|fringe/i;

/** A correction for each failed shot worth a second render; back-panel small print is left to the fix list */
function writeComments() {
  const path = join(runDir!, "comments.json");
  const comments: Record<string, Record<string, string>> = existsSync(path) ? readJson(path) : {};
  for (const name of readdirSync(join(runDir!, "products")).filter((f) => f.endsWith(".json"))) {
    const product = readJson<{ id: string; main: string; shots: { file: string; verdict: string | null; differences: string[] }[] }>(`products/${name}`);
    for (const shot of product.shots.filter((s) => s.verdict === "fail" && !comments[product.id]?.[s.file])) {
      const found = shot.differences.join(" ");
      const parts = [
        HALO.test(found) ? "Clean cut-out edges: no glow, halo, haze or stray marks around the pack." : "",
        shot.file === product.main ? `Keep every word, logo and number exactly as photographed. Last time these came out wrong: ${shot.differences.filter((d) => d.startsWith("critical")).join("; ").slice(0, 400)}` : "",
      ].filter(Boolean);
      if (parts.length) comments[product.id] = { ...comments[product.id], [shot.file]: parts.join(" ") };
    }
  }
  writeFileSync(path, JSON.stringify(comments, null, 1));
  console.log(`${Object.values(comments).reduce((n, byFile) => n + Object.keys(byFile).length, 0)} shots in comments.json`);
}

if (argv.includes("--refs")) await writeRefs();
else if (argv.includes("--todo")) splitTodo(Number(value("--todo")) || 1);
else if (argv.includes("--check")) check();
else if (argv.includes("--pairs")) await writePairs();
else if (argv.includes("--comments")) writeComments();
else throw new Error("Pass --refs, --todo N, --check, --pairs or --comments");
