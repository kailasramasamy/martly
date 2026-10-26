import { parseHomeSectionConfig, type HeroCardEntry } from "@martly/shared/schemas";
import type { HomeSectionType } from "@martly/shared/constants";

/**
 * Old collection id → its copy, or null when the copy was dropped (too few products at the new store).
 * Ids it doesn't know are global collections, which every organisation shares, so they stay as they are.
 */
export type CollectionMap = Map<string, string | null>;

export const resolveCollection = (map: CollectionMap, id: string) => (map.has(id) ? map.get(id)! : id);

function remapHeroCards(config: Record<string, unknown>, map: CollectionMap) {
  const cards = (config.cards as HeroCardEntry[] | undefined)?.flatMap((card): HeroCardEntry[] => {
    if (card.kind === "COLLECTION") {
      const id = resolveCollection(map, card.collectionId);
      return id ? [{ ...card, collectionId: id }] : [];
    }
    if (card.kind === "STORE_SPECIAL" && card.collectionId) {
      const id = resolveCollection(map, card.collectionId);
      return [id ? { ...card, collectionId: id } : { kind: "STORE_SPECIAL" }];
    }
    return [card];
  });
  const rightNow = Object.fromEntries(Object.entries((config.rightNow as Record<string, string> | undefined) ?? {})
    .map(([part, id]) => [part, resolveCollection(map, id)])
    .filter(([, id]) => id));
  return { ...config, cards: cards?.length ? cards : undefined, rightNow };
}

/**
 * A template section's config pointed at the new organisation's collections; null when the section can't be copied
 * (its brand card shows the template's own brand, which stays with the template).
 */
export function remapSectionConfig(
  type: HomeSectionType, config: unknown, map: CollectionMap, templateBrandIds: Set<string>,
): Record<string, unknown> | null {
  const raw = (config ?? {}) as Record<string, unknown>;
  if (type === "BRAND_CARD" && templateBrandIds.has(raw.brandId as string)) return null;
  const remapped = type === "HERO_CARDS" ? remapHeroCards(raw, map) : raw;
  return parseHomeSectionConfig(type, remapped);
}
