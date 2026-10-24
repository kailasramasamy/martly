import {
  SECTION_COLLECTION, SectionHeaderStyle, TabRailStyle, type HomeSectionType,
} from "@martly/shared/constants";
import { homeSectionConfigSchemas, homeSectionItemsSchema, type HomeSectionItemsInput } from "@martly/shared/schemas";
import type { HomeSectionRecord } from "./types";

export interface ItemLimits {
  min: number;
  max: number;
  noun: string;
}

/** Item-backed types: tabs of a tabbed row and tiles of the grids */
export const ITEM_LIMITS: Partial<Record<HomeSectionType, ItemLimits>> = {
  TABBED_ROW: { min: 2, max: 8, noun: "tab" },
  EXPLORE_GRID: { min: 2, max: 12, noun: "tile" },
  STORE_GRID: { min: 2, max: 12, noun: "tile" },
};

export const MIN_BANDS = 2;
export const MAX_BANDS = 5;

/** Types whose settings this screen edits; the rest keep their stored config untouched */
export const CONFIG_TYPES: readonly HomeSectionType[] = ["PRODUCT_ROW", "TABBED_ROW", "PRICE_BAND_DEALS", "BRAND_CARD", "CATEGORY_DIRECTORY", "EXPLORE_GRID", "STORE_GRID"];

/** Types offered when adding a section from the phone */
export const CREATABLE_TYPES: readonly HomeSectionType[] = ["PRODUCT_ROW", "CAMPAIGN_CARD", "TABBED_ROW", "PRICE_BAND_DEALS", "BRAND_CARD", "CATEGORY_DIRECTORY", "EXPLORE_GRID", "STORE_GRID"];

/** A tab or grid tile; the image and aisles are edited in the admin panel but must survive a save here */
export interface ItemDraft {
  key: string;
  label: string;
  /** Not edited on the phone, but carried so a save doesn't drop the translated labels */
  translations?: Record<string, { label: string }>;
  collectionId: string | null;
  imageUrl: string | null;
  subcategoryIds: string[];
  wide: boolean;
}

export interface BandDraft {
  key: string;
  label: string;
  /** Empty = open-ended band */
  maxPrice: string;
}

export interface FormValues {
  type: HomeSectionType | null;
  title: string;
  subtitle: string;
  collectionId: string | null;
  isActive: boolean;
  headerStyle: SectionHeaderStyle;
  tint: string;
  tabStyle: TabRailStyle;
  items: ItemDraft[];
  headline: string;
  bands: BandDraft[];
  brandId: string | null;
  departmentIds: string[];
}

let nextKey = 0;
export const newKey = () => `draft-${nextKey++}`;

const DEFAULT_BANDS = [19, 29, 49, 99].map((price): BandDraft => ({ key: newKey(), label: `Under ₹${price}`, maxPrice: String(price) }));

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function emptyForm(): FormValues {
  return {
    type: null, title: "", subtitle: "", collectionId: null, isActive: true,
    headerStyle: SectionHeaderStyle.PLAIN, tint: "",
    tabStyle: TabRailStyle.ICON_CARD, items: [], headline: "", bands: DEFAULT_BANDS.map((b) => ({ ...b, key: newKey() })),
    brandId: null, departmentIds: [],
  };
}

export function sectionToForm(section: HomeSectionRecord): FormValues {
  const c = section.config;
  const base = emptyForm();
  return {
    ...base,
    type: section.type as HomeSectionType,
    title: section.title ?? "",
    subtitle: section.subtitle ?? "",
    collectionId: section.collectionId,
    isActive: section.isActive,
    headerStyle: (c.headerStyle as SectionHeaderStyle) ?? base.headerStyle,
    tint: str(c.tint),
    tabStyle: (c.tabStyle as TabRailStyle) ?? base.tabStyle,
    items: (section.items ?? []).map((i) => ({ key: newKey(), label: i.label, translations: i.translations ?? undefined, collectionId: i.collectionId, imageUrl: i.imageUrl, subcategoryIds: i.subcategoryIds, wide: i.wide })),
    headline: str(c.headline),
    bands: Array.isArray(c.bands) ? c.bands.map((b: { label: string; maxPrice: number | null }) => ({ key: newKey(), label: b.label, maxPrice: b.maxPrice === null ? "" : String(b.maxPrice) })) : base.bands,
    brandId: str(c.brandId) || null,
    departmentIds: Array.isArray(c.departmentIds) ? c.departmentIds : [],
  };
}

/** Fields of the per-type config as the API expects them; unedited keys of the stored config ride along */
function configDraft(type: HomeSectionType, v: FormValues, stored: Record<string, unknown>): Record<string, unknown> {
  const tint = v.tint.trim() || undefined;
  switch (type) {
    case "PRODUCT_ROW":
      return { ...stored, headerStyle: v.headerStyle, tint };
    case "TABBED_ROW":
      return { ...stored, tabStyle: v.tabStyle, tint };
    case "PRICE_BAND_DEALS":
      return { ...stored, headline: v.headline.trim() || undefined, bands: v.bands.map((b) => ({ label: b.label, maxPrice: b.maxPrice.trim() === "" ? null : Number(b.maxPrice) })) };
    case "BRAND_CARD":
      return { ...stored, brandId: v.brandId, tint };
    default:
      return { ...stored, departmentIds: v.departmentIds };
  }
}

const issueText = (issues: { path: PropertyKey[]; message: string }[]) =>
  issues.map((i) => [...i.path.map(String), i.message].join(": ")).join("; ");

export interface SectionBody {
  title: string | null;
  subtitle: string | null;
  collectionId?: string | null;
  isActive: boolean;
  config?: Record<string, unknown>;
}

export interface BuiltSection {
  body: SectionBody;
  items?: HomeSectionItemsInput["items"];
}

/** Validates against the shared schemas and builds the request bodies, or returns the problem for a toast */
export function buildSection(v: FormValues, section: HomeSectionRecord | undefined): BuiltSection | { error: string } {
  const type = v.type;
  if (!type) return { error: "Choose a section type" };
  const mode = SECTION_COLLECTION[type];
  if (mode === "REQUIRED" && !v.collectionId) return { error: "Pick a collection" };

  const body: SectionBody = {
    title: v.title.trim() || null,
    subtitle: v.subtitle.trim() || null,
    collectionId: mode ? v.collectionId : undefined,
    isActive: v.isActive,
  };
  const schema = homeSectionConfigSchemas[type as keyof typeof homeSectionConfigSchemas];
  if (CONFIG_TYPES.includes(type) && schema) {
    const parsed = schema.safeParse(configDraft(type, v, section?.config ?? {}));
    if (!parsed.success) return { error: issueText(parsed.error.issues) };
    body.config = parsed.data;
  }
  const limits = ITEM_LIMITS[type];
  return limits ? buildItems(v.items, limits, body) : { body };
}

function buildItems(drafts: ItemDraft[], { min, max, noun }: ItemLimits, body: SectionBody): BuiltSection | { error: string } {
  const items = drafts.map((t) => ({
    label: t.label.trim(), translations: t.translations, collectionId: t.collectionId ?? "", imageUrl: t.imageUrl ?? undefined, subcategoryIds: t.subcategoryIds, wide: t.wide,
  }));
  if (items.length < min || items.length > max) return { error: `Add ${min} to ${max} ${noun}s` };
  if (items.some((t) => !t.collectionId)) return { error: `Every ${noun} needs a collection` };
  const parsedItems = homeSectionItemsSchema.safeParse({ items });
  if (!parsedItems.success) return { error: issueText(parsedItems.error.issues) };
  return { body, items: parsedItems.data.items };
}
