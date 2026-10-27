import type { HomeSection } from "@martly/shared/types";
import type { HomeSectionType } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";

export type StoreRef = { id: string; organizationId: string };

export interface ResolveContext {
  prisma: PrismaClient;
  store: StoreRef;
  /** Empty for guests */
  userId: string;
  now: Date;
  /** How product shelves are drawn: the app's grid keeps whole rows of three, the website's rail scrolls and takes them all */
  shelves: "grid" | "rail";
}

export interface LayoutItem {
  id: string;
  label: string;
  translations: unknown;
  imageUrl: string | null;
  collectionId: string | null;
  subcategoryIds: string[];
  wide: boolean;
}

/** One entry of the layout, saved or synthetic, before the app-facing expansion of automatic sections */
export interface LayoutEntry {
  id: string;
  type: HomeSectionType;
  title: string | null;
  subtitle: string | null;
  translations: unknown;
  collectionId: string | null;
  config: Record<string, unknown>;
  items: LayoutItem[];
  /** Campaign cards that lead the others: a brand-paid promotion's, then a live festival's that missed the hero */
  cardLead?: "BRAND" | "FESTIVAL";
}

export type ResolvedSection = HomeSection<any>;
export type SectionResolver = (ctx: ResolveContext, entry: LayoutEntry) => Promise<ResolvedSection | null>;

export function sectionBase(entry: LayoutEntry) {
  return {
    id: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    translations: (entry.translations ?? null) as SectionTranslations | null,
  };
}

type SectionTranslations = Record<string, { title?: string; subtitle?: string; headline?: string; offerLabel?: string; bandLabels?: string[] }>;

/**
 * A collection-backed section's text: the collection fills whatever the section leaves unset. In other languages the
 * section's own translation wins; without one, a field shows the collection's translation when its English is the
 * collection's (unset, or the same words), so a section that only renames its title keeps the translated subtitle.
 */
export function withCollectionText(
  base: ReturnType<typeof sectionBase>,
  collection: { title: string; subtitle: string | null; translations: unknown },
) {
  const own = base.translations ?? {};
  const lent = (collection.translations ?? {}) as SectionTranslations;
  const borrowsTitle = base.title == null || base.title === collection.title;
  const borrowsSubtitle = base.subtitle == null || base.subtitle === collection.subtitle;
  const translations: SectionTranslations = {};
  for (const lang of new Set([...Object.keys(own), ...Object.keys(lent)])) {
    translations[lang] = {
      ...own[lang],
      title: own[lang]?.title ?? (borrowsTitle ? lent[lang]?.title : undefined),
      subtitle: own[lang]?.subtitle ?? (borrowsSubtitle ? lent[lang]?.subtitle : undefined),
    };
  }
  return { title: base.title ?? collection.title, subtitle: base.subtitle ?? collection.subtitle, translations };
}
