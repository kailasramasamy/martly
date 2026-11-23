import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { estimateCapacityMl, formatItemSize, itemSizeRows } from "@martly/shared/item-size";
import type { CatalogDraftItemInput } from "@martly/shared/schemas";
import { putObject } from "../media.js";
import { MODEL, ExtractRefusedError, type Label } from "./extract.js";
import { imageBlock } from "./photos.js";
import { claudeUsage } from "./usage.js";

const ItemSchema = z.object({
  name: z.string().describe("Plain shopper-friendly name without size or brand, e.g. 'Stainless Steel Serving Bowl', 'Plastic Bucket with Handle'"),
  material: z.string().nullable().describe("Material you can clearly see, e.g. 'Stainless steel', 'Plastic'; null if unclear"),
  isContainer: z.boolean().describe("True if it holds liquid or food or stores things: vessel, tumbler, bowl, dabba, bucket, tub. False for spoons, ladles, plates, mats and tools"),
  description: z.string().describe("2-3 factual sentences on what it is and what it's used for at home. No quality claims and no sizes"),
  tags: z.array(z.string()).describe("3-6 lowercase search words a shopper might type"),
  confidence: z.enum(["high", "medium", "low"]).describe("How sure you are what this item is"),
});
export type DescribedItem = z.infer<typeof ItemSchema>;

const SYSTEM = `You write catalogue listings for unbranded household items sold in Indian stores: steel vessels, tumblers, spoons,
plastic buckets, floor mats and similar, from a store worker's phone photos taken from above, the front and the side.
Say only what the photos show. Never guess a brand, steel grade, gauge, weight, country of origin, or dishwasher or microwave safety.
Ignore the table and anything in the background.`;

/** Names and describes an item from its photos; the size is given as fact and is not something to read off the photos */
export async function describeItem(photos: Buffer[], item: CatalogDraftItemInput, hintName: string | null) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, photo] of photos.entries()) {
    content.push({ type: "text", text: `Photo ${i}:` }, await imageBlock(photo));
  }
  const size = itemSizeRows(item).map((r) => `${r.label} ${r.value}`).join(", ");
  content.push({ type: "text", text: `Measured size: ${size}.${hintName ? ` The store worker calls it "${hintName}".` : ""}` });
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(ItemSchema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new ExtractRefusedError("The item describer returned nothing");
  return { result: response.parsed_output, usage: claudeUsage("describe-item", MODEL, response.usage) };
}

/** Standing items come as Top, Front, Angled, Side (older builds and typed sizes have no Angled), with Front as the main photo; flat items only have top views, so the first is theirs */
function itemPhotoRole(shape: CatalogDraftItemInput["shape"], index: number, photoCount: number) {
  if (index === 0 && (shape === "FLAT" || photoCount === 1)) return "front" as const;
  if (shape === "FLAT" || index === 0) return "top" as const;
  if (index === 1) return "front" as const;
  return index === 2 && photoCount === 4 ? "angled" as const : "side" as const;
}

const GALLERY_ORDER = ["front", "angled", "side", "top"];

/** The word marked on a photo; a flat item's main photo has the "front" role but is a top view */
export function shotLegend(label: Pick<Label, "shots">, index: number, shape: string) {
  if (shape === "FLAT") return "Top";
  const role = label.shots.find((s) => s.index === index)?.role ?? "front";
  return role[0].toUpperCase() + role.slice(1);
}

/** An item's listing photos: Front, its size image so it's the first thing shoppers swipe to, then Side and Top. The size image is drawn on the Angled photo, so that one only shows without it */
export function itemGallery(label: Pick<Label, "shots">, shots: { index: number; url: string }[], sizeImage: string | null | undefined, legendUrls: Record<string, string> = {}) {
  const role = (index: number) => label.shots.find((s) => s.index === index)?.role;
  const rank = (index: number) => GALLERY_ORDER.indexOf(role(index) ?? "");
  const shown = sizeImage ? shots.filter((s) => role(s.index) !== "angled") : shots;
  const [main, ...rest] = [...shown].sort((a, b) => rank(a.index) - rank(b.index)).map((s) => legendUrls[s.index] ?? s.url);
  return [...(main ? [main] : []), ...(sizeImage ? [sizeImage] : []), ...rest];
}

/** Puts an item into the same shape as a read label, so filing, review and publishing need no second path */
export function itemLabel(item: DescribedItem, size: CatalogDraftItemInput, photoCount: number): Label {
  return {
    shots: Array.from({ length: photoCount }, (_, index) => ({ index, role: itemPhotoRole(size.shape, index, photoCount) })),
    name: item.name,
    brand: null,
    variantName: formatItemSize(size),
    unitType: "PIECE",
    unitValue: 1,
    barcode: null,
    printedMrp: null,
    foodType: null,
    productType: "HOUSEHOLD",
    ingredients: null,
    nutrition: [],
    allergens: [],
    fssaiLicense: null,
    manufacturerName: null,
    countryOfOrigin: null,
    shelfLifeDays: null,
    storageType: null,
    storageInstructions: null,
    usageInstructions: null,
    dangerWarnings: null,
    description: item.description,
    tags: item.tags,
    confidence: { name: item.confidence, size: "high", brand: "high" },
    notes: "",
  };
}

export interface ItemVariantFields {
  shape: CatalogDraftItemInput["shape"];
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  topDiameterMm: number | null;
  baseDiameterMm: number | null;
  capacityMl: number | null;
  capacityIsEstimate: boolean;
  sketchUrl: string | null;
}

export interface ItemFacts {
  variant: ItemVariantFields;
  sketchUrl: string | null;
  /** Gallery copies of the photos with their view marked, by photo index */
  legendUrls?: Record<string, string>;
  material: string | null;
}

/** A marked capacity always wins; otherwise only real containers get an estimate */
export function itemCapacity(item: CatalogDraftItemInput, isContainer: boolean) {
  if (item.markedCapacityMl) return { capacityMl: item.markedCapacityMl, capacityIsEstimate: false };
  const estimate = isContainer ? estimateCapacityMl(item, item.reading?.baseScale) : null;
  return { capacityMl: estimate, capacityIsEstimate: estimate !== null };
}

/** The confirmed size and worked-out capacity; the size image comes later, once the photos are cleaned */
export function itemFacts(item: CatalogDraftItemInput, isContainer: boolean, material: string | null = null): ItemFacts {
  return {
    sketchUrl: null,
    material,
    variant: {
      shape: item.shape,
      lengthMm: item.lengthMm ?? null,
      widthMm: item.widthMm ?? null,
      heightMm: item.heightMm ?? null,
      topDiameterMm: item.topDiameterMm ?? null,
      baseDiameterMm: item.baseDiameterMm ?? null,
      ...itemCapacity(item, isContainer),
      sketchUrl: null,
    },
  };
}
