import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { CurationRefusedError } from "./curator.js";
import type { SubcategoryCandidate } from "./candidates.js";

const MODEL = "claude-sonnet-5-5";
const GRID_COLUMNS = 3;
const MAX_TILES = 6;

const TileSchema = z.object({
  title: z.string().describe("tile label, 1-3 words, e.g. 'Pooja Needs', 'Vrat Snacks'"),
  titleTa: z.string().describe("natural Tamil label"),
  subcategoryIds: z.array(z.string()).describe("1-4 ids from the list that this tile opens"),
  artPrompt: z.string().describe("the few physical items in this tile's illustration, e.g. 'a brass diya, marigold garland and incense sticks'"),
});

const HeroSchema = z.object({
  heroTitle: z.string().describe("2-3 word celebratory invitation, e.g. 'Celebrate Navratri', 'Diwali Ready', 'Monsoon Ready'; not a collection name"),
  heroTitleTa: z.string().describe("natural Tamil headline"),
  backgroundPrompt: z.string().describe("the decorative artwork for the top of the background, without any text"),
  washColor: z.string().describe("hex colour of the pale wash filling the lower background, e.g. '#fff3d6'"),
  titleColor: z.string().describe("hex colour for the headline, strongly contrasting with the wash, e.g. '#9f1239'"),
  tiles: z.array(TileSchema).describe(`exactly ${MAX_TILES} tiles, or ${GRID_COLUMNS} if the catalog only supports a few themes`),
});
export type HeroDesign = z.infer<typeof HeroSchema>;

const SYSTEM = `You design the festive top section of the home screen of Martly, a grocery delivery app for neighbourhood
stores in India. The section is a decorated background with a headline and a 3-column grid of shopping tiles.

Group the in-stock subcategories shoppers will buy for the occasion into ${MAX_TILES} themed tiles (${GRID_COLUMNS} if only a few
themes are credible), most important first: rituals and pooja, festive cooking, sweets and snacks, gifting, decor,
kids, hosting. Each tile opens 1-4 subcategories; a subcategory belongs to at most one tile. Respect the event's
guidance strictly; never pick alcohol, tobacco, or anything out of place for the occasion.

Each tile's artPrompt names 2-4 physical items that read instantly at thumbnail size: generic products and
festival props only, never brand packaging, logos, text, or people.

backgroundPrompt describes flat, premium vector-style festive ornamentation for the top quarter of a tall phone
background (torans, hanging lamps, rangoli motifs, flowers, the season's weather), in the festival's own colours,
fading into a calm pale wash that fills the rest. washColor is that wash; keep it light so dark text and white
tiles sit on it cleanly. titleColor is a deep festive colour that reads strongly on the wash.

Write the Tamil copy in everyday native Tamil words rather than English words spelled in Tamil script.`;

export interface HeroBrief {
  description: string;
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
      content: `${brief.description}\n\nIn-stock subcategories (id | department > category > subcategory (product count)):\n${catalog}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new CurationRefusedError(`Hero designer returned no result (stop_reason: ${response.stop_reason})`);
  }
  return withValidTiles(response.parsed_output, new Set(candidates.map((c) => c.id)));
}

// Drops unknown or reused subcategories, then keeps whole grid rows so the layout never has a gap
function withValidTiles(design: HeroDesign, known: Set<string>): HeroDesign {
  const used = new Set<string>();
  const tiles = design.tiles.flatMap((tile) => {
    const ids = tile.subcategoryIds.filter((id) => known.has(id) && !used.has(id));
    ids.forEach((id) => used.add(id));
    return ids.length ? [{ ...tile, subcategoryIds: ids }] : [];
  }).slice(0, MAX_TILES);
  return { ...design, tiles: tiles.slice(0, tiles.length - (tiles.length % GRID_COLUMNS)) };
}
