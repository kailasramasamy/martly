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
}

export type ResolvedSection = HomeSection<any>;
export type SectionResolver = (ctx: ResolveContext, entry: LayoutEntry) => Promise<ResolvedSection | null>;

export function sectionBase(entry: LayoutEntry) {
  return {
    id: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    translations: (entry.translations ?? null) as Record<string, { title?: string; subtitle?: string }> | null,
  };
}
