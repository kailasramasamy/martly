import { z } from "zod";
import { HeroTileLayout, HomeSectionType, SectionHeaderStyle, TabRailStyle } from "../constants/home.js";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");
const theme = z.object({ background: hex, title: hex, dark: z.boolean() });

/** Per-type display settings stored in HomeSection.config */
export const homeSectionConfigSchemas = {
  FESTIVE_HERO: z.object({ tileLayout: z.nativeEnum(HeroTileLayout).default("GRID") }),
  PRODUCT_ROW: z.object({
    headerStyle: z.nativeEnum(SectionHeaderStyle).default("PLAIN"),
    headerImageUrl: z.string().url().optional(),
    tint: hex.optional(),
    maxProducts: z.number().int().min(3).max(20).default(12),
  }),
  CAMPAIGN_CARD: z.object({
    offerLabel: z.string().trim().max(24).optional(),
    imageUrl: z.string().url().optional(),
    theme: theme.optional(),
    tileSource: z.enum(["AUTO", "ITEMS"]).default("AUTO"),
  }),
  TABBED_ROW: z.object({ tabStyle: z.nativeEnum(TabRailStyle).default("ICON_CARD"), tint: hex.optional() }),
  PRICE_BAND_DEALS: z.object({
    headline: z.string().trim().max(40).optional(),
    bands: z.array(z.object({ label: z.string().trim().min(1).max(16), maxPrice: z.number().positive().nullable() })).min(2).max(5),
  }),
  BRAND_CARD: z.object({ brandId: z.string().uuid(), tint: hex.optional(), imageUrl: z.string().url().optional() }),
  CATEGORY_DIRECTORY: z.object({ departmentIds: z.array(z.string().uuid()).default([]) }),
} as const;

/** Config for a type, or `{}` for types without settings */
export function parseHomeSectionConfig(type: HomeSectionType, config: unknown): Record<string, unknown> {
  const schema = homeSectionConfigSchemas[type as keyof typeof homeSectionConfigSchemas];
  return schema ? schema.parse(config ?? {}) : {};
}

const translations = z.record(z.string(), z.object({ title: z.string().optional(), subtitle: z.string().optional() })).optional();

export const createHomeSectionSchema = z.object({
  type: z.nativeEnum(HomeSectionType),
  // Null leaves the collection's own title or subtitle showing
  title: z.string().trim().max(80).nullish(),
  subtitle: z.string().trim().max(120).nullish(),
  translations,
  collectionId: z.string().uuid().nullish(),
  config: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
});
export type CreateHomeSectionInput = z.infer<typeof createHomeSectionSchema>;

export const updateHomeSectionSchema = createHomeSectionSchema.partial().omit({ type: true });
export type UpdateHomeSectionInput = z.infer<typeof updateHomeSectionSchema>;

export const reorderHomeSectionsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export const homeSectionItemsSchema = z.object({
  items: z.array(z.object({
    label: z.string().trim().min(1).max(40),
    translations: z.record(z.string(), z.object({ label: z.string() })).optional(),
    imageUrl: z.string().url().nullish(),
    collectionId: z.string().uuid().nullish(),
    subcategoryIds: z.array(z.string().uuid()).default([]),
    wide: z.boolean().default(false),
  })).max(24),
});
export type HomeSectionItemsInput = z.infer<typeof homeSectionItemsSchema>;

/** Which tiles of a grid section to paint art for; none named paints every tile without an image */
export const homeSectionArtSchema = z.object({ itemIds: z.array(z.string().uuid()).max(24).optional(), repaint: z.boolean().default(false) });

// The cursor carries the sponsored products already shown, so it grows a little with each page
export const homeSectionsQuerySchema = z.object({ cursor: z.string().max(2000).optional() });

export const homeDealsQuerySchema = z.object({
  sectionId: z.string().uuid(),
  band: z.coerce.number().int().min(0).max(4).default(0),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(50).default(1),
});
