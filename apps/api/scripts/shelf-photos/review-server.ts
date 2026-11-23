/**
 * Local review pages for the shelf-photo import. Listens on this computer only and saves to the run folder.
 *
 *   npx tsx scripts/shelf-photos/review-server.ts --run ~/Downloads/psb-products-2026-11-02/run
 *   http://localhost:7003/ groups the photos; http://localhost:7003/approve approves the finished products
 */
import { execFile } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { promisify } from "node:util";

dotenv.config({ override: true });
const { MODEL } = await import("../../src/services/catalog-agent/extract.js");

const PORT = 7003;
const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const runDir = argv[argv.indexOf("--run") + 1];
if (!runDir || !existsSync(join(runDir, "groups.json"))) throw new Error("--run must be a folder with groups.json (run group.ts first)");
const photosDir = argv.includes("--photos") ? argv[argv.indexOf("--photos") + 1] : join(runDir, "..", "105APPLE");

interface Group { id: string; photos: string[]; main: string; confidence: string; note: string; skip?: boolean; checked?: boolean }

const readJson = <T>(name: string) => JSON.parse(readFileSync(join(runDir, name), "utf8")) as T;

/** Writes through a temp file, so a crash can't leave half a file behind */
function writeJson(name: string, value: unknown) {
  const path = join(runDir, name);
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 1));
  renameSync(`${path}.tmp`, path);
}

function send(res: ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

const sendJson = (res: ServerResponse, value: unknown, status = 200) => send(res, status, "application/json", JSON.stringify(value));

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Every photo must stay in exactly one group, so a page bug can't lose a photo */
function groupingError(groups: Group[]) {
  const known = Object.keys(readJson<Record<string, unknown>>("reads.json")).sort();
  const sent = groups.flatMap((g) => g.photos).sort();
  if (known.length !== sent.length || known.some((file, i) => file !== sent[i])) return "Every photo must be in exactly one group";
  if (groups.some((g) => !g.photos.includes(g.main))) return "A group's main photo must be one of its photos";
  return null;
}

async function saveGroups(req: IncomingMessage, res: ServerResponse) {
  let groups: Group[];
  try {
    groups = JSON.parse(await body(req)) as Group[];
  } catch (err) {
    if (err instanceof SyntaxError) return sendJson(res, { error: "Not valid JSON" }, 400);
    throw err;
  }
  const error = groupingError(groups);
  if (error) return sendJson(res, { error }, 400);
  writeJson("groups.json", groups);
  sendJson(res, { saved: groups.length });
}

function sendPhoto(res: ServerResponse, name: string) {
  const path = join(runDir, "previews", basename(name));
  if (!existsSync(path)) return send(res, 404, "text/plain", "No such photo");
  res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "max-age=3600" });
  createReadStream(path).pipe(res);
}

interface NutritionRow { name: string; value: string }
interface Decision {
  status: "approved" | "rejected" | "held"; mrp?: number; sellingPrice?: number; name?: string; variantName?: string;
  ingredients?: string; nutrition?: NutritionRow[]; nutritionText?: string;
}
type Decisions = Record<string, Decision>;

function loadDecisions(): Decisions {
  return existsSync(join(runDir, "decisions.json")) ? readJson<Decisions>("decisions.json") : {};
}

function loadProducts() {
  const dir = join(runDir, "products");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson<{ id: string }>(join("products", f)));
}

const Nutrition = z.object({ rows: z.array(z.object({ name: z.string(), value: z.string() })) });
const NUTRITION_SYSTEM = `Turn pasted nutrition text from a grocery label into rows of nutrient name and amount, with its unit. Copy every number exactly and
don't add a nutrient that isn't there. Use clear names like "Energy", "Total Fat", "Saturated Fat". If the text has several columns, use the per 100 g (or per 100 ml)
column, otherwise the first column, and leave out % RDA or % daily value. If it says what the amounts are per, make the first row name "Nutrition Per" with a value like "100 g".
If the text has no nutrition facts, give no rows.`;

class FormatError extends Error {}

/** Lines already in "name: amount" form are kept as they are; anything else goes to Haiku */
async function formatNutrition(text: string): Promise<NutritionRow[]> {
  if (!text) return [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.every((line) => /^[^:\d]+:\s*\S/.test(line))) {
    return lines.map((line) => ({ name: line.slice(0, line.indexOf(":")).trim(), value: line.slice(line.indexOf(":") + 1).trim() }));
  }
  const response = await new Anthropic().beta.messages.create({
    model: MODEL, max_tokens: 2000, system: NUTRITION_SYSTEM, output_config: { format: betaZodOutputFormat(Nutrition) }, messages: [{ role: "user", content: text }],
  });
  if (response.stop_reason !== "end_turn") throw new FormatError(`stopped with ${response.stop_reason}`);
  const answer = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  const { rows } = Nutrition.parse(JSON.parse(answer));
  if (!rows.length) throw new FormatError("no nutrition facts found in that text");
  return rows;
}

/** Replaces pasted nutrition text with its rows; returns an error message if it can't be read */
async function tidyNutrition(decision: Decision) {
  if (decision.nutritionText === undefined) return null;
  try {
    decision.nutrition = await formatNutrition(decision.nutritionText);
    delete decision.nutritionText;
    return null;
  } catch (err) {
    if (err instanceof Anthropic.APIError || err instanceof FormatError || err instanceof SyntaxError) return `Couldn't tidy the nutrition text: ${err.message}. Nothing was saved.`;
    throw err;
  }
}

async function saveDecision(req: IncomingMessage, res: ServerResponse) {
  let sent: { id: string; decision: Decision | null };
  try {
    sent = JSON.parse(await body(req)) as typeof sent;
  } catch (err) {
    if (err instanceof SyntaxError) return sendJson(res, { error: "Not valid JSON" }, 400);
    throw err;
  }
  if (!existsSync(join(runDir, "products", `${basename(sent.id)}.json`))) return sendJson(res, { error: "Unknown product" }, 404);
  const { decision } = sent;
  if (decision?.status === "approved" && !(Number(decision.mrp) > 0 && Number(decision.sellingPrice) > 0)) return sendJson(res, { error: "Enter the MRP and selling price first" }, 400);
  if (decision?.status === "approved" && Number(decision.sellingPrice) > Number(decision.mrp)) return sendJson(res, { error: "Selling price can't be above MRP" }, 400);
  const failed = decision ? await tidyNutrition(decision) : null;
  if (failed) return sendJson(res, { error: failed }, 502);
  const decisions = loadDecisions();
  if (decision) decisions[sent.id] = decision;
  else delete decisions[sent.id];
  writeJson("decisions.json", decisions);
  sendJson(res, { saved: true, decision });
}

type Comments = Record<string, Record<string, string>>;

function loadComments(): Comments {
  return existsSync(join(runDir, "comments.json")) ? readJson<Comments>("comments.json") : {};
}

/** A note on one image, for the second pass; separate from approving, and an empty note removes it */
async function saveComment(req: IncomingMessage, res: ServerResponse) {
  let sent: { id: string; file: string; text: string };
  try {
    sent = JSON.parse(await body(req)) as typeof sent;
  } catch (err) {
    if (err instanceof SyntaxError) return sendJson(res, { error: "Not valid JSON" }, 400);
    throw err;
  }
  const path = join(runDir, "products", `${basename(sent.id)}.json`);
  if (!existsSync(path) || !readJson<{ photos: string[] }>(join("products", `${basename(sent.id)}.json`)).photos.includes(sent.file)) return sendJson(res, { error: "Unknown image" }, 404);
  const comments = loadComments();
  const text = sent.text.trim();
  const forProduct = { ...comments[sent.id], [sent.file]: text };
  if (!text) delete forProduct[sent.file];
  if (Object.keys(forProduct).length) comments[sent.id] = forProduct;
  else delete comments[sent.id];
  writeJson("comments.json", comments);
  sendJson(res, { saved: true });
}

/** The original photo at full size for zooming, converted once because browsers can't show HEIC */
async function sendFullPhoto(res: ServerResponse, name: string) {
  const file = basename(name);
  const source = join(photosDir, file);
  if (!existsSync(source)) return send(res, 404, "text/plain", "No such photo");
  const out = file.replace(/\.(heic|jpe?g)$/i, ".jpg");
  if (!existsSync(join(runDir, "full", out))) {
    mkdirSync(join(runDir, "full"), { recursive: true });
    await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", source, "--out", join(runDir, "full", out)]);
  }
  sendFile(res, "full", out, "image/jpeg");
}

function sendFile(res: ServerResponse, folder: string, name: string, type: string) {
  const path = join(runDir, folder, basename(name));
  if (!existsSync(path)) return send(res, 404, "text/plain", "No such file");
  res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
  createReadStream(path).pipe(res);
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (req.method === "GET" && pathname === "/") return send(res, 200, "text/html; charset=utf-8", readFileSync(join(HERE, "grouping.html"), "utf8"));
  if (req.method === "GET" && pathname === "/approve") return send(res, 200, "text/html; charset=utf-8", readFileSync(join(HERE, "approval.html"), "utf8"));
  if (req.method === "GET" && pathname === "/api/products") return sendJson(res, { products: loadProducts(), decisions: loadDecisions(), comments: loadComments(), crops: existsSync(join(runDir, "mrp-crops")) ? readdirSync(join(runDir, "mrp-crops")) : [], hidden: existsSync(join(runDir, "hidden.json")) ? readJson<unknown>("hidden.json") : {} });
  if (req.method === "POST" && pathname === "/api/decision") return void saveDecision(req, res);
  if (req.method === "POST" && pathname === "/api/comment") return void saveComment(req, res);
  if (req.method === "GET" && pathname.startsWith("/rendered/")) {
    const name = basename(decodeURIComponent(pathname.slice("/rendered/".length)));
    // The version with MRP, batch and dates hidden, once that step has run
    return sendFile(res, existsSync(join(runDir, "final", name)) ? "final" : "rendered", name, "image/webp");
  }
  if (req.method === "GET" && pathname.startsWith("/photo-full/")) return void sendFullPhoto(res, decodeURIComponent(pathname.slice("/photo-full/".length)));
  if (req.method === "GET" && pathname.startsWith("/mrp-crop/")) return sendFile(res, "mrp-crops", decodeURIComponent(pathname.slice("/mrp-crop/".length)), "image/jpeg");
  if (req.method === "GET" && pathname === "/api/groups") return sendJson(res, { groups: readJson<Group[]>("groups.json"), reads: readJson<unknown>("reads.json") });
  if (req.method === "POST" && pathname === "/api/groups") return void saveGroups(req, res);
  if (req.method === "GET" && pathname.startsWith("/photo/")) return sendPhoto(res, decodeURIComponent(pathname.slice("/photo/".length)));
  send(res, 404, "text/plain", "Not found");
});

server.listen(PORT, "127.0.0.1", () => console.log(`Review pages at http://localhost:${PORT}/`));
