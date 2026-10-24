import { createContext, useContext } from "react";
import { router } from "expo-router";
import type { HomeSeeAll, HomeTheme } from "@martly/shared/types";
import { useLanguage } from "../../../lib/language-context";
import type { MobileHomeSection } from "../../../lib/use-home-sections";
import type { Store } from "../../../lib/types";
import type { MemberStatus } from "../use-member-status";

export interface HomeSectionEnv {
  store: Store;
  memberStatus: MemberStatus | null;
  hasSubscriptions: boolean;
  /** The live festivals' collections; hero carousel banners that just point at one are left out */
  festiveHeroIds: string[];
  /** The festive hero slide or hero card in view, whose colours the header takes */
  onFestiveTheme: (theme: HomeTheme) => void;
  /** The section leading the page; only it themes the header and runs up behind it */
  leadId: string | null;
  /** The festive hero slide's colours while a festival leads the page */
  festiveTheme: HomeTheme | null;
  /** The section right under a leading festive hero, which continues its colour so the top reads as one block */
  afterHeroId: string | null;
  /** Whether the festive hero is on screen; its carousel only advances by itself while it is */
  heroInView: boolean;
  /** When the festive block runs up behind the overlaid header: the header's height to clear; null when the
   *  header sits above the list */
  backdrop: { top: number } | null;
}

const HomeSectionContext = createContext<HomeSectionEnv | null>(null);

export const HomeSectionProvider = HomeSectionContext.Provider;

export function useHomeSectionEnv() {
  const env = useContext(HomeSectionContext);
  if (!env) throw new Error("useHomeSectionEnv must be used within a HomeSectionProvider");
  return env;
}

/**
 * A section's title and subtitle in the shopper's language, plus its translation for the labels the admin typed into
 * its settings (headline, offer, bands), which each section falls back from to the English it was given
 */
export function useSectionText(section: Pick<MobileHomeSection, "title" | "subtitle" | "translations">) {
  const { language } = useLanguage();
  const t = language ? section.translations?.[language] : undefined;
  return { title: t?.title || section.title, subtitle: t?.subtitle || section.subtitle, translated: t };
}

export function openSeeAll(seeAll: HomeSeeAll) {
  if ("href" in seeAll) {
    router.push(seeAll.href as never);
    return;
  }
  openCollection(seeAll.collectionId, seeAll.subcategoryIds);
}

export function openCollection(collectionId: string, subcategoryIds?: string[]) {
  const params: { id: string; subcategoryIds?: string } = { id: collectionId };
  if (subcategoryIds?.length) params.subcategoryIds = subcategoryIds.join(",");
  router.push({ pathname: "/collection/[id]", params });
}
