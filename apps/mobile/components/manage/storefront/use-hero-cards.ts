import type { Href } from "expo-router";
import type { HeroCardFix } from "@martly/shared/constants";
import { homeSectionConfigSchemas, type HeroCardEntry } from "@martly/shared/schemas";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useHomeLayout } from "../home-layout/use-home-layout";
import type { HomeLayoutData, HomeSectionRecord } from "../home-layout/types";
import { useStorefrontHealth } from "./storefront";

export type HeroConfig = ReturnType<typeof homeSectionConfigSchemas.HERO_CARDS.parse>;
export type { HeroCardEntry };

const BASE = "/api/v1/home-layout";

/** Where a card that isn't ready gets what it needs; RIGHT_NOW and COLLECTION are set on the hero cards screen */
export function heroFixHref(fix: HeroCardFix, storeId: string, collectionId?: string): Href {
  switch (fix) {
    case "OFFERS": return { pathname: "/manage/offers/new", params: { storeId } };
    case "STORE_SPECIAL": return { pathname: "/manage/storefront/hero-ai", params: { storeId, kind: "STORE_SPECIAL" } };
    case "COLLECTION": return collectionId ? { pathname: "/manage/collections/[id]", params: { id: collectionId } } : { pathname: "/manage/storefront/hero-cards", params: { storeId } };
    case "RIGHT_NOW": return { pathname: "/manage/storefront/hero-cards", params: { storeId } };
  }
}

// The saved hero section, making the organisation's own layout first when it still follows the default
async function heroSection(layout: HomeLayoutData, org: string, config: HeroConfig): Promise<HomeSectionRecord> {
  const sections = layout.isDefault ? (await api.post<HomeLayoutData>(`${BASE}/customize${org}`, {})).data.sections : layout.sections;
  const hero = sections.find((s) => s.type === "HERO_CARDS");
  if (hero) return hero;
  return (await api.post<HomeSectionRecord>(`${BASE}${org}`, { type: "HERO_CARDS", config })).data;
}

/** The hero carousel's cards with each one's readiness at the store, and a save that writes the whole card list */
export function useHeroCards(storeId: string) {
  const { org, layout } = useHomeLayout();
  const health = useStorefrontHealth(storeId, true);
  const { run, running } = useAction();
  const section = layout.data?.sections.find((s) => s.type === "HERO_CARDS") ?? null;
  const config = homeSectionConfigSchemas.HERO_CARDS.parse(section?.config ?? {});
  const readiness = health.data?.checks.find((c) => c.key === "HERO_CARDS")?.cards ?? [];

  const save = async (next: HeroConfig, message?: string) => {
    if (!layout.data) return false;
    const data = layout.data;
    const done = await run(async () => {
      const hero = await heroSection(data, org, next);
      await api.patch(`${BASE}/${hero.id}${org}`, { config: next, isActive: true });
      return true;
    }, message);
    await Promise.all([layout.reload(), health.reload()]);
    return done === true;
  };

  return {
    config, readiness, save, running, isActive: section?.isActive ?? true,
    loading: layout.loading || health.loading, error: layout.error ?? health.error,
    reload: () => Promise.all([layout.reload(), health.reload()]),
  };
}
