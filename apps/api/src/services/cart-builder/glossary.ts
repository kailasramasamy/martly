import { GLOSSARY_LANGUAGES, REGION_LANGUAGES, type FestivalRegion, type GlossaryLanguage } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";

type Entry = { searchTerm: string; note: string | null; phrases: { language: string; text: string }[] };

// Read once and kept, so a list costs no glossary query; an admin edit drops it at once
const TTL_MS = 5 * 60_000;
let cache: { at: number; entries: Entry[] } | null = null;

export function invalidateGlossary() {
  cache = null;
}

async function activeEntries(prisma: PrismaClient): Promise<Entry[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.entries;
  const entries = await prisma.listGlossaryTerm.findMany({
    where: { isActive: true },
    orderBy: { searchTerm: "asc" },
    select: { searchTerm: true, note: true, phrases: { select: { language: true, text: true }, orderBy: [{ language: "asc" }, { text: "asc" }] } },
  });
  cache = { at: Date.now(), entries };
  return entries;
}

/**
 * The glossary languages a store's lists need: those spoken in its organisation's regions, plus the shopper's app
 * language. Null means every language (no region with a known language, and no app language given).
 */
export async function storeLanguages(prisma: PrismaClient, storeId: string, appLanguage?: string): Promise<GlossaryLanguage[] | null> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { organization: { select: { festivalRegions: true } } } });
  const languages = new Set<GlossaryLanguage>();
  for (const region of store?.organization.festivalRegions ?? []) {
    const language = REGION_LANGUAGES[region as FestivalRegion];
    if (language) languages.add(language);
  }
  if (appLanguage && appLanguage in GLOSSARY_LANGUAGES) languages.add(appLanguage as GlossaryLanguage);
  return languages.size > 0 ? [...languages].sort() : null;
}

/**
 * The glossary block for the list reader's prompt: each term's phrases in the given languages and the catalog word,
 * e.g. `கடலை மாவு / kadalai maavu → "besan" (raw gram flour, never roasted)`. Always in the same order, so the
 * prompt only changes when the glossary does.
 */
export async function glossaryPrompt(prisma: PrismaClient, languages: GlossaryLanguage[] | null) {
  const lines = (await activeEntries(prisma)).flatMap((e) => {
    const said = e.phrases.filter((p) => !languages || languages.includes(p.language as GlossaryLanguage)).map((p) => p.text);
    return said.length > 0 ? [`${said.join(" / ")} → "${e.searchTerm}"${e.note ? ` (${e.note})` : ""}`] : [];
  });
  return lines.length > 0 ? `Staples as shoppers say them, and the word this catalog uses:\n${lines.join("\n")}` : "";
}
