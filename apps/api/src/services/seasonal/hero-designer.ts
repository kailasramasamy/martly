import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { CurationRefusedError } from "./curator.js";
import type { SubcategoryCandidate } from "./candidates.js";
import type { HeroTheme } from "./hero-art.js";

const MODEL = "claude-sonnet-5-5";
const MIN_TILES = 3;
const MAX_TILES = 6;

const TileSchema = z.object({
  title: z.string().describe("tile label, 1-3 words, e.g. 'Pooja Needs', 'Vrat Snacks'"),
  titleTa: z.string().describe("natural Tamil label"),
  subcategoryIds: z.array(z.string()).describe("1-4 ids from the list that this tile opens"),
  artPrompt: z.string().describe("the few physical items in this tile's illustration, e.g. 'a brass diya, marigold garland and incense sticks'"),
});

const HeroSchema = z.object({
  heroTitle: z.string().describe("2-3 word celebratory invitation in Title Case (never all capitals), e.g. 'Celebrate Navratri', 'Diwali Ready', 'Monsoon Ready'; not a collection name"),
  heroTitleTa: z.string().describe("natural Tamil headline"),
  heroKicker: z.string().describe("short line above the headline, 2-5 words, Sentence case, e.g. 'Nine nights of devotion'"),
  heroKickerTa: z.string().describe("natural Tamil kicker"),
  heroSubtitle: z.string().describe("one line for the festival's campaign card, 4-9 words, Sentence case, what shoppers get, e.g. 'Fasting staples, pooja needs and sweets'"),
  heroSubtitleTa: z.string().describe("natural Tamil subtitle"),
  silhouetteScene: z.string().describe("the festive silhouette strip's motifs, e.g. 'garba dancers twirling dandiya sticks, hanging diyas, string lights and marigold torans'"),
  font: z.enum(["PLAYFAIR", "YATRA", "KALAM", "LOBSTER"]).describe("headline typeface that suits the festival"),
  themeColor: z.string().describe("hex of the rich festive hue the block is tinted with, e.g. '#1f7a4d'"),
  tiles: z.array(TileSchema).describe(`${MIN_TILES}-${MAX_TILES} tiles`),
});
export type HeroDesign = z.infer<typeof HeroSchema>;

const SYSTEM = `You design the festive top section of the home screen of Martly, a grocery delivery app for neighbourhood
stores in India. The section is a pale wash of a festive hue with a faint silhouette strip behind a short greeting (kicker
and headline), then a row of shopping tiles.

Group the in-stock subcategories shoppers will buy for the occasion into ${MIN_TILES}-${MAX_TILES} themed tiles, as many as
the catalog credibly supports, most important first: rituals and pooja, festive cooking, sweets and snacks, gifting,
decor, kids, hosting. Each tile opens 1-4 subcategories; a subcategory belongs to at most one tile. Respect the event's
guidance strictly; never pick alcohol, tobacco, or anything out of place for the occasion.

Each tile's artPrompt names 2-4 physical items that read instantly at thumbnail size: generic products and
festival props only, never brand packaging, logos, text, or people.

themeColor is a rich hue that suits the festival (e.g. Navratri green or magenta, Diwali saffron, Christmas pine); the
app turns it into a pale wash behind the block and a deep shade of it for the text, so crimson, maroon and rose all wash
out to Valentine's pink: keep those for festivals that are meant to look romantic. silhouetteScene lists the motifs
for a wide, low strip of faint silhouettes running behind the greeting: people celebrating, lamps, string lights,
torans, the season's weather. It is drawn in shades of the theme hue, so describe shapes, not colours.

font sets the headline's character: PLAYFAIR (elegant serif; the safe default, good for most festivals and seasons),
YATRA (Indian, Devanagari-inspired display; Navratri, Diwali, Dussehra, Ganesh Chaturthi), KALAM (warm handwriting;
Raksha Bandhan, Pongal, Onam, Mother's Day), LOBSTER (playful script; Christmas, New Year, Holi, summer fun).

Write the Tamil copy in everyday native Tamil words rather than English words spelled in Tamil script.`;

export interface HeroBrief {
  description: string;
  /** Heroes that can share the home carousel with this one */
  neighbours: { title: string; theme: HeroTheme }[];
}

// Slides side by side must not look like one festival, so the designer steers clear of the others' looks
function neighbourNote(neighbours: HeroBrief["neighbours"]) {
  if (neighbours.length === 0) return "";
  const looks = neighbours.map((n) => `- ${n.title}: ${n.theme.background}, ${n.theme.font ?? "PLAYFAIR"}`).join("\n");
  return `\n\nThese heroes can share the home carousel with this one. Pick a themeColor from a clearly different hue `
    + `family than every one of them, and a font none of them uses (if all four are taken, the one used least):\n${looks}`;
}

export async function designHero(brief: HeroBrief, candidates: SubcategoryCandidate[]): Promise<HeroDesign> {
  const client = new Anthropic();
  const catalog = candidates.map((c) => `${c.id} | ${c.department} > ${c.category} > ${c.name} (${c.products})`).join("\n");
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(HeroSchema) },
    messages: [{
      role: "user",
      content: `${brief.description}${neighbourNote(brief.neighbours)}\n\nIn-stock subcategories (id | department > category > subcategory (product count)):\n${catalog}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new CurationRefusedError(`Hero designer returned no result (stop_reason: ${response.stop_reason})`);
  }
  return withValidTiles(response.parsed_output, new Set(candidates.map((c) => c.id)));
}

// Drops unknown or reused subcategories, and tiles left with none
function withValidTiles(design: HeroDesign, known: Set<string>): HeroDesign {
  const used = new Set<string>();
  const tiles = design.tiles.flatMap((tile) => {
    const ids = tile.subcategoryIds.filter((id) => known.has(id) && !used.has(id));
    ids.forEach((id) => used.add(id));
    return ids.length ? [{ ...tile, subcategoryIds: ids }] : [];
  });
  return { ...design, tiles: tiles.slice(0, MAX_TILES) };
}
