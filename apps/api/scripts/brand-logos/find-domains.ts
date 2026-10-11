import Anthropic from "@anthropic-ai/sdk";
import { DomainEntry, Overrides, TopBrand, readJson, writeJson } from "./common.js";

const BATCH = 25;
const MODEL = "claude-haiku-4-5-20251001";

const PROMPT = `For each Indian grocery/FMCG brand below, give the domain of its OFFICIAL website (no scheme, no path, e.g. "fortunefoods.com").
Rules:
- Use the sample product names to identify the category; pick the company that makes THAT kind of product (e.g. "Fortune (Adani Wilmar)" with edible oils is fortunefoods.com, not fortune.com).
- Text in parentheses is the parent company, not part of the brand name.
- Prefer the Indian site (.in, .co.in or the company's India site) when one exists.
- If you are not sure, return null. Never guess.
Return ONLY a JSON array: [{"name": "<brand name exactly as given>", "domain": "<domain or null>"}]

Brands:
`;

function describe(b: TopBrand): string {
  return `- ${b.name} (products: ${b.samples.join("; ")})`;
}

async function askBatch(client: Anthropic, batch: TopBrand[]): Promise<Record<string, string | null>> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: PROMPT + batch.map(describe).join("\n") }],
  });
  const block = response.content[0];
  const match = (block.type === "text" ? block.text : "").match(/\[.*\]/s);
  if (!match) return {};
  const rows = JSON.parse(match[0]) as { name: string; domain: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.name, cleanDomain(r.domain)]));
}

function cleanDomain(raw: string | null): string | null {
  if (!raw || raw === "null") return null;
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || null;
}

export async function findDomains(brands: TopBrand[], overrides: Overrides): Promise<DomainEntry[]> {
  const cache = new Map(readJson<DomainEntry[]>("domains.json", []).map((e) => [e.brandId, e]));
  const pending: TopBrand[] = [];
  const result: DomainEntry[] = [];
  for (const b of brands) {
    if (b.name in overrides) {
      result.push({ brandId: b.id, name: b.name, domain: overrides[b.name] });
    } else if (cache.has(b.id)) {
      result.push(cache.get(b.id)!);
    } else {
      pending.push(b);
    }
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const answers = await askBatch(client, batch);
    for (const b of batch) result.push({ brandId: b.id, name: b.name, domain: answers[b.name] ?? null });
    console.log(`domains: ${Math.min(i + BATCH, pending.length)}/${pending.length} asked`);
  }
  const order = new Map(brands.map((b, i) => [b.id, i]));
  result.sort((a, b) => order.get(a.brandId)! - order.get(b.brandId)!);
  writeJson("domains.json", result);
  return result;
}
