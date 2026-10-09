/**
 * Generate transparent cut-out images for departments/categories.
 * Run: cd apps/api && npx tsx scripts/taxonomy-images/generate.ts --level department [--only a,b] [--quality medium|high] [--force]
 * Output: scripts/taxonomy-images/out/<level>/<slug>.png (1024 master) + .webp (512) + out/contact.html
 */

import OpenAI from "openai";
import sharp from "sharp";
import dotenv from "dotenv";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Project .env must win over a global OPENAI_API_KEY exported in the shell profile
dotenv.config({ override: true });

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const MODEL = "gpt-image-1.5";
const CONCURRENCY = 4;

const STYLE = `Professional category image for an Indian grocery delivery app.
Photorealistic studio product photography, cut out on a fully transparent background: no backdrop, no table surface, no extra props.
Camera at a slight 30-degree top-down angle. Soft diffused key light from the top-left, a gentle soft contact shadow directly beneath the items.
Compact, balanced cluster with a roughly square overall footprint (about as tall as it is wide), centred in frame with generous empty margin on every side.
Generic unbranded items only: absolutely no text, letters, numbers, logos, labels, brand names or printed packaging graphics.
Fresh, appetising, natural vibrant colours, crisp focus.`;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function generate(subject: string, quality: "low" | "medium" | "high"): Promise<Buffer> {
  const res = await openai.images.generate({
    model: MODEL,
    prompt: `${STYLE}\n\nSubject: ${subject}.`,
    size: "1024x1024",
    quality,
    background: "transparent",
    output_format: "png",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned");
  return Buffer.from(b64, "base64");
}

// Trim to the subject, then re-centre with uniform 6% padding so every tile has the same visual weight
async function normalise(raw: Buffer, size: number): Promise<sharp.Sharp> {
  const trimmed = await sharp(raw).trim({ threshold: 1 }).toBuffer();
  const inner = Math.round(size * 0.88);
  const fitted = await sharp(trimmed)
    .resize(inner, inner, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((size - fitted.info.width) / 2);
  const top = Math.floor((size - fitted.info.height) / 2);
  return sharp(fitted.data).extend({
    left, top,
    right: size - fitted.info.width - left,
    bottom: size - fitted.info.height - top,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}

async function processOne(level: string, slug: string, subject: string, quality: "low" | "medium" | "high") {
  const dir = join(OUT, level);
  const rawPath = join(dir, "raw", `${slug}.png`);
  const raw = await generate(subject, quality);
  writeFileSync(rawPath, raw);
  await (await normalise(raw, 1024)).png({ compressionLevel: 9 }).toFile(join(dir, `${slug}.png`));
  await (await normalise(raw, 512)).webp({ quality: 85, alphaQuality: 90 }).toFile(join(dir, `${slug}.webp`));
  console.log(`  done: ${level}/${slug}`);
}

function writeContactSheet() {
  const sections = readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const slugs = readdirSync(join(OUT, d.name)).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
      const cards = slugs.map((s) => `<figure><div class="app"><img src="${d.name}/${s}.webp"></div>
<div class="white"><img src="${d.name}/${s}.webp"></div><div class="dark"><img src="${d.name}/${s}.webp"></div><figcaption>${s}</figcaption></figure>`);
      return `<h2>${d.name} (${slugs.length})</h2><div class="grid">${cards.join("")}</div>`;
    });
  writeFileSync(join(OUT, "contact.html"), `<!doctype html><meta charset="utf-8"><title>Taxonomy images</title><style>
body{font:14px system-ui;margin:24px;background:#f8fafc;color:#0f172a}.grid{display:flex;flex-wrap:wrap;gap:20px}
figure{margin:0;display:grid;grid-template-columns:96px 160px 160px;gap:8px;align-items:center;background:#fff;padding:10px;border:1px solid #e2e8f0;border-radius:12px}
figcaption{grid-column:1/-1;color:#64748b}img{width:100%;height:100%;object-fit:contain}
.app{width:96px;height:96px;border-radius:21px;background:#f0fdfa;border:1px solid #ccfbf1;padding:6px;box-sizing:border-box}
.white,.dark{width:160px;height:160px;border-radius:8px}.white{background:#fff;border:1px solid #e2e8f0}.dark{background:#0f172a}
</style><h1>Taxonomy images</h1><p>Left: actual app tile (96px, teal tint). Middle: white. Right: dark mode.</p>${sections.join("")}`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      level: { type: "string", default: "department" },
      only: { type: "string" },
      quality: { type: "string", default: "medium" },
      force: { type: "boolean", default: false },
    },
  });
  const level = values.level!;
  const quality = values.quality as "low" | "medium" | "high";
  const subjects: Record<string, string> = JSON.parse(readFileSync(join(ROOT, "subjects.json"), "utf8"))[level];
  if (!subjects) throw new Error(`No subjects for level "${level}"`);
  mkdirSync(join(OUT, level, "raw"), { recursive: true });

  const only = values.only?.split(",");
  const todo = Object.entries(subjects).filter(([slug]) =>
    (!only || only.includes(slug)) && (values.force || !existsSync(join(OUT, level, `${slug}.webp`))));
  console.log(`Generating ${todo.length} ${level} image(s) with ${MODEL} (${quality})`);

  const failures: string[] = [];
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(todo.slice(i, i + CONCURRENCY).map(([slug, subject]) => processOne(level, slug, subject, quality)));
    results.forEach((r, j) => {
      if (r.status === "rejected") failures.push(`${todo[i + j][0]}: ${r.reason?.message ?? r.reason}`);
    });
  }
  writeContactSheet();
  if (failures.length) console.error(`Failed:\n  ${failures.join("\n  ")}`);
  console.log(`Contact sheet: ${join(OUT, "contact.html")}`);
}

main();
