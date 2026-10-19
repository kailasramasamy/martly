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
  /** The festive hero in view, whose colours the header takes */
  onFestiveTheme: (theme: HomeTheme) => void;
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

/** A section's title and subtitle in the shopper's language */
export function useSectionText(section: Pick<MobileHomeSection, "title" | "subtitle" | "translations">) {
  const { language } = useLanguage();
  const t = language ? section.translations?.[language] : undefined;
  return { title: t?.title || section.title, subtitle: t?.subtitle || section.subtitle };
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
