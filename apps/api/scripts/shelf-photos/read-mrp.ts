/**
 * Reads each product's MRP a second time, from the original photos, because the published images hide it. Fills a missing
 * price, keeps the printed text so the approval page can show it, and marks a product whose two readings disagree.
 * Re-running picks up only products not read yet. --crops then reads the close-ups from crop-mrp.py for products still
 * without a price or with two readings that differ; a close-up reading replaces the earlier ones.
 *
 *   npx tsx scripts/shelf-photos/read-mrp.ts --run ~/Downloads/psb-products-2026-11-02/run [--crops]
 */
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

dotenv.config({ override: true });
const { imageBlock } = await import("../../src/services/catalog-agent/photos.js");
const { MODEL } = await import("../../src/services/catalog-agent/extract.js");

const CONCURRENCY = 6;
const Answer = z.object({
  mrp: z.number().nullable().describe("The pack's MRP in rupees, or null if it can't be read with certainty"),
  printedText: z.string().nullable().describe("The MRP text exactly as printed on the pack"),
});
const PROMPT = `These photos show one grocery pack. Find its MRP (Maximum Retail Price, often "MRP Rs.", "M.R.P.", or a stamped or inkjet
price near the batch and date details, sometimes on a seam or on its side). Give the price of the whole pack including taxes. Don't
use the unit sale price (per g or per ml), net weight, batch number, dates or nutrition figures. Use null rather than guessing a
digit you can't read. A printed "MRP" caption with nothing stamped anywhere near it means null. Stamps are often misaligned, so the
amount can sit a line away from its caption: "249.00 (Rs. 0.98/g)" means the MRP is 249 and 0.98 is the unit price.`;

interface MrpCheck { mrp: number | null; printedText: string | null; conflict: boolean; cropMrp?: number | null; cropText?: string | null }
interface Product { id: string; photos: string[]; label: { printedMrp: number | null; mrpCheck?: MrpCheck } }
class UnreadableAnswer extends Error {}

const argv = process.argv.slice(2);
const runDir = argv[argv.indexOf("--run") + 1];
if (!runDir) throw new Error("--run is required");
const client = new Anthropic();
const cropsDir = join(runDir, "mrp-crops");
const useCrops = argv.includes("--crops");
const cropsOf = (id: string) => (existsSync(cropsDir) ? readdirSync(cropsDir).filter((f) => f.startsWith(`${id}-`)).map((f) => join(cropsDir, f)) : []);
const previewsOf = (product: Product) => product.photos.map((file) => join(runDir, "previews", file.replace(/\.(heic|jpe?g)$/i, ".jpg")));

async function read(paths: string[]) {
  const images = await Promise.all(paths.map(async (path) => imageBlock(readFileSync(path))));
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1500,
    output_config: { format: betaZodOutputFormat(Answer) },
    messages: [{ role: "user", content: [...images, { type: "text", text: PROMPT }] }],
  });
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  if (response.stop_reason !== "end_turn") throw new UnreadableAnswer(`stopped with ${response.stop_reason}`);
  return Answer.parse(JSON.parse(text));
}

function apply(product: Product, answer: z.infer<typeof Answer>) {
  const first = product.label.printedMrp;
  product.label.mrpCheck = { ...answer, conflict: first != null && answer.mrp != null && first !== answer.mrp };
  product.label.printedMrp = first ?? answer.mrp;
}

function applyCrops(product: Product, answer: z.infer<typeof Answer>) {
  product.label.mrpCheck = { ...product.label.mrpCheck!, cropMrp: answer.mrp, cropText: answer.printedText };
  product.label.printedMrp = answer.mrp ?? product.label.printedMrp;
}

function write(path: string, product: Product) {
  writeFileSync(`${path}.tmp`, JSON.stringify(product, null, 1));
  renameSync(`${path}.tmp`, path);
}

const dir = join(runDir, "products");
const queue = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const path = queue.shift()!;
    const product = JSON.parse(readFileSync(path, "utf8")) as Product;
    const check = product.label.mrpCheck;
    const wanted = useCrops ? check && check.cropMrp == null && (!product.label.printedMrp || check.conflict) && cropsOf(product.id).length : !check;
    if (!wanted) continue;
    try {
      const answer = await read(useCrops ? cropsOf(product.id) : previewsOf(product));
      (useCrops ? applyCrops : apply)(product, answer);
      write(path, product);
    } catch (err) {
      if (!(err instanceof Anthropic.APIError || err instanceof UnreadableAnswer || err instanceof SyntaxError)) throw err;
      console.error(`${product.id}: ${err.message} (a re-run picks it up)`);
    }
  }
}));
