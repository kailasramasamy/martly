import {
  HOME_ROW_MAX_PRODUCTS, SECTION_COLLECTION, SectionHeaderStyle, TabRailStyle, type HomeSectionType,
} from "@martly/shared/constants";
import { homeSectionConfigSchemas, homeSectionItemsSchema } from "@martly/shared/schemas";
import type { HomeSectionRecord } from "./types";

export const MIN_TABS = 2;
export const MAX_TABS = 8;
export const MIN_BANDS = 2;
export const MAX_BANDS = 5;

/** Types whose settings this screen edits; the rest keep their stored config untouched */
export const CONFIG_TYPES: readonly HomeSectionType[] = ["PRODUCT_ROW", "TABBED_ROW", "PRICE_BAND_DEALS", "BRAND_CARD", "CATEGORY_DIRECTORY"];

/** Types offered when adding a section from the phone */
export const CREATABLE_TYPES: readonly HomeSectionType[] = ["PRODUCT_ROW", "CAMPAIGN_CARD", "TABBED_ROW", "PRICE_BAND_DEALS", "BRAND_CARD", "CATEGORY_DIRECTORY"];

export interface TabDraft {
  key: string;
  label: string;
  collectionId: string | null;
  imageUrl: string | null;
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
  maxProducts: string;
  tabStyle: TabRailStyle;
  tabs: TabDraft[];
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
    headerStyle: SectionHeaderStyle.PLAIN, tint: "", maxProducts: String(HOME_ROW_MAX_PRODUCTS),
    tabStyle: TabRailStyle.ICON_CARD, tabs: [], headline: "", bands: DEFAULT_BANDS.map((b) => ({ ...b, key: newKey() })),
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
    maxProducts: c.maxProducts ? String(c.maxProducts) : base.maxProducts,
    tabStyle: (c.tabStyle as TabRailStyle) ?? base.tabStyle,
    tabs: (section.items ?? []).map((i) => ({ key: newKey(), label: i.label, collectionId: i.collectionId, imageUrl: i.imageUrl })),
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
      return { ...stored, headerStyle: v.headerStyle, tint, maxProducts: Number(v.maxProducts) };
    case "TABBED_ROW":
      return { ...stored, tabStyle: v.tabStyle };
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
  items?: { label: string; collectionId: string; imageUrl?: string }[];
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
  if (type !== "TABBED_ROW") return { body };

  const items = v.tabs.map((t) => ({ label: t.label.trim(), collectionId: t.collectionId ?? "", imageUrl: t.imageUrl ?? undefined }));
  if (items.length < MIN_TABS || items.length > MAX_TABS) return { error: `Add ${MIN_TABS} to ${MAX_TABS} tabs` };
  if (items.some((t) => !t.collectionId)) return { error: "Every tab needs a collection" };
  const parsedItems = homeSectionItemsSchema.safeParse({ items });
  if (!parsedItems.success) return { error: issueText(parsedItems.error.issues) };
  return { body, items };
}
