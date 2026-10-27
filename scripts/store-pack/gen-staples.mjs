// Blank pouch photos for loose staples: each is an AI edit of the toor dal photo, so every pouch keeps the
// pillow-1kg-full template's exact shape. Skips photos that already exist; re-run to retry failures.
//   node scripts/store-pack/gen-staples.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_PHOTO = join(HERE, "ai/pillow-toor-dal-wide2.png");
const STAPLES = join(HERE, "../../apps/api/prisma/data/store-pack-staples.json");
const CONCURRENCY = 6;

// The API's .env, not the shell: the shell's OPENAI_API_KEY belongs to an account without credits
const env = readFileSync(join(HERE, "../../apps/api/.env"), "utf8");
const KEY = env.match(/^OPENAI_API_KEY=["']?([^"'\n]+)/m)[1];

export const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const prompt = (contents) => "Keep this exact photo: the same clear unprinted pillow pouch, identical size, shape, position, crimped seals, "
  + `folds, lighting, reflections and transparent background. Only replace the toor dal inside the pouch with ${contents}, `
  + "filling the pouch the same way. No labels, no text, no shadow.";

const ATTEMPTS = 3;
const RATE_LIMIT_WAITS = 10;
const RATE_LIMIT_PAUSE_MS = 15_000;

// fetch throws TypeError on a dropped connection (EPIPE, reset); one bad socket shouldn't end the batch
async function editWithRetry(form) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form });
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
    }
  }
  return null;
}

async function generate({ name, contents }) {
  const out = join(HERE, `ai/staples/pillow-${slugOf(name)}.png`);
  const form = new FormData();
  for (const [k, v] of Object.entries({ model: "gpt-image-2.5-flare", quality: "medium", size: "1024x1024", background: "transparent", output_format: "png", prompt: prompt(contents) })) form.append(k, v);
  form.append("image[]", new Blob([readFileSync(BASE_PHOTO)], { type: "image/png" }), "pouch.png");
  let res = await editWithRetry(form);
  // 20 edits a minute per org: wait out the window instead of failing
  for (let waits = 0; res?.status === 429 && waits < RATE_LIMIT_WAITS; waits++) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS));
    res = await editWithRetry(form);
  }
  if (!res) return console.log(`FAIL ${name}: network`);
  const body = await res.json();
  if (!res.ok) return console.log(`FAIL ${name}: ${body.error?.message ?? res.status}`);
  writeFileSync(out, Buffer.from(body.data[0].b64_json, "base64"));
  console.log(`ok ${name}`);
}

const todo = JSON.parse(readFileSync(STAPLES, "utf8")).filter((s) => !s.photo && !existsSync(join(HERE, `ai/staples/pillow-${slugOf(s.name)}.png`)));
console.log(`${todo.length} photos to generate`);
const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let s = queue.shift(); s; s = queue.shift()) await generate(s);
}));
