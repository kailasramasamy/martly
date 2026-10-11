import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DomainEntry, FetchEntry, LOGO_DIR, readJson, slugify, writeJson } from "./common.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 10_000;
const RETRY_TIMEOUT_MS = 20_000;
const CONCURRENCY = 8;
const MAX_CANDIDATES = 10;

type Kind = "header-img" | "apple-touch" | "icon" | "og-image";
interface Candidate { url: string; kind: Kind; size: number }
interface Picked { png: Buffer; url: string; kind: Kind; score: number }

/** Expected per-brand failures (network, timeout, bad image); anything else is a bug and propagates. */
class FetchFail extends Error {}

const BASE_SCORE: Record<Kind, number> = { "header-img": 100, "apple-touch": 70, icon: 50, "og-image": 10 };

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] ?? m[3];
  return out;
}

const sizeOf = (sizes?: string) => Number(sizes?.match(/(\d+)x\d+/)?.[1] ?? 0);

function resolveUrl(href: string | undefined, base: string): string | null {
  if (!href || href.startsWith("data:")) return null;
  try {
    return new URL(href.trim(), base).href;
  } catch (err) {
    if (err instanceof TypeError) return null;
    throw err;
  }
}

export function extractCandidates(html: string, base: string): Candidate[] {
  const found: Candidate[] = [];
  const add = (href: string | undefined, kind: Kind, size = 0) => {
    const url = resolveUrl(href, base);
    if (url) found.push({ url, kind, size });
  };
  let headerImgs = 0;
  for (const m of html.matchAll(/<(link|img|meta)\b[^>]*>/gi)) {
    const tag = m[1].toLowerCase();
    const a = attrs(m[0]);
    if (tag === "link") {
      const rel = (a.rel ?? "").toLowerCase();
      const size = sizeOf(a.sizes);
      if (rel.includes("apple-touch-icon")) add(a.href, "apple-touch", size);
      else if (rel.split(/\s+/).includes("icon") || rel === "shortcut icon") {
        if (size >= 128 || /\.svg(\?|$)/i.test(a.href ?? "")) add(a.href, "icon", size);
      }
    } else if (tag === "img" && headerImgs < 4) {
      if (/logo/i.test(`${a.src} ${a.alt} ${a.class} ${a.id}`)) {
        add(a.src ?? a["data-src"], "header-img");
        headerImgs++;
      }
    } else if (tag === "meta" && a.property === "og:image") {
      add(a.content, "og-image");
    }
  }
  add("/apple-touch-icon.png", "apple-touch");
  return found;
}

async function get(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new FetchFail(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    if (err instanceof FetchFail) throw err;
    if (err instanceof TypeError || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))) {
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      throw new FetchFail(cause ?? err.name);
    }
    throw err;
  }
}

async function loadHome(domain: string): Promise<{ html: string; base: string }> {
  const tries = [`https://${domain}/`, `https://www.${domain}/`];
  let failure = new FetchFail("unreachable");
  for (const [i, url] of tries.entries()) {
    try {
      const res = await get(url, i === 0 ? TIMEOUT_MS : RETRY_TIMEOUT_MS);
      return { html: await res.text(), base: res.url };
    } catch (err) {
      if (!(err instanceof FetchFail)) throw err;
      if (i === 0) failure = err;
    }
  }
  throw failure;
}

async function rasterise(buf: Buffer, svg: boolean): Promise<{ png: Buffer; w: number; h: number }> {
  try {
    const png = await sharp(buf, svg ? { density: 300 } : {}).png().toBuffer();
    const meta = await sharp(png).metadata();
    return { png, w: meta.width ?? 0, h: meta.height ?? 0 };
  } catch (err) {
    if (err instanceof Error) throw new FetchFail(`bad image: ${err.message.slice(0, 40)}`);
    throw err;
  }
}

async function tryCandidate(c: Candidate): Promise<Picked> {
  const res = await get(c.url);
  const type = res.headers.get("content-type") ?? "";
  const svg = type.includes("svg") || /\.svg(\?|$)/i.test(c.url);
  if (!svg && !type.startsWith("image/")) throw new FetchFail("not an image");
  const { png, w, h } = await rasterise(Buffer.from(await res.arrayBuffer()), svg);
  const short = Math.min(w, h);
  const ratio = Math.max(w, h) / Math.max(short, 1);
  const wordmark = c.kind === "header-img";
  if (short < (wordmark || svg ? 40 : 96)) throw new FetchFail(`too small ${w}x${h}`);
  if (c.kind === "og-image" && ratio > 2.5) throw new FetchFail("banner");
  if (ratio > 8) throw new FetchFail("too wide");
  const score = BASE_SCORE[c.kind] + (svg ? 20 : 0) + Math.min(short, 512) / 100;
  return { png, url: c.url, kind: c.kind, score };
}

async function normalise(png: Buffer, outFile: string): Promise<void> {
  const flat = await sharp(png).flatten({ background: "#ffffff" }).png().toBuffer();
  const trimmed = await sharp(flat).trim({ background: "#ffffff", threshold: 12 }).toBuffer();
  const fitted = await sharp(trimmed)
    .resize(216, 216, { fit: "contain", background: "#ffffff" })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  writeFileSync(outFile, fitted);
}

async function bestLogo(domain: string): Promise<Picked> {
  const { html, base } = await loadHome(domain);
  const seen = new Set<string>();
  const candidates = extractCandidates(html, base)
    .filter((c) => !seen.has(c.url) && seen.add(c.url))
    .slice(0, MAX_CANDIDATES);
  const picks: Picked[] = [];
  let lastReason = "no candidates";
  for (const c of candidates) {
    try {
      picks.push(await tryCandidate(c));
    } catch (err) {
      if (!(err instanceof FetchFail)) throw err;
      lastReason = `${c.kind}: ${err.message}`;
    }
  }
  if (!picks.length) throw new FetchFail(lastReason);
  return picks.sort((a, b) => b.score - a.score)[0];
}

async function processOne(d: DomainEntry & { domain: string }): Promise<FetchEntry> {
  const slug = slugify(d.name);
  const base = { brandId: d.brandId, name: d.name, domain: d.domain, slug };
  try {
    const pick = await bestLogo(d.domain);
    const file = `${slug}.png`;
    await normalise(pick.png, join(LOGO_DIR, file));
    return { ...base, file, source: pick.url, kind: pick.kind, reason: null };
  } catch (err) {
    if (!(err instanceof FetchFail)) throw err;
    return { ...base, file: null, source: null, kind: null, reason: err.message };
  }
}

/** Re-fetches entries that are new, changed domain, or named in `force`; reuses the rest. */
export async function fetchLogos(domains: DomainEntry[], force: Set<string>, retryFailed = false): Promise<FetchEntry[]> {
  const cache = new Map(readJson<FetchEntry[]>("fetch.json", []).map((e) => [e.brandId, e]));
  const todo = domains.filter((d): d is DomainEntry & { domain: string } => {
    const prev = cache.get(d.brandId);
    return !!d.domain && (!prev || prev.domain !== d.domain || force.has(d.name) || (retryFailed && !prev.file));
  });
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const done = await Promise.all(todo.slice(i, i + CONCURRENCY).map(processOne));
    for (const e of done) {
      cache.set(e.brandId, e);
      console.log(`${e.file ? "ok  " : "FAIL"} ${e.name.padEnd(30)} ${e.domain.padEnd(26)} ${e.kind ?? e.reason}`);
    }
  }
  const result = domains.filter((d) => d.domain && cache.has(d.brandId)).map((d) => cache.get(d.brandId)!);
  writeJson("fetch.json", result);
  return result;
}
