import type { HomeSection } from "../types/home.js";

// The row a hero card stands in for; the server still sends these for app builds without the hero cards
const STANDS_IN_FOR = { FESTIVE: "FESTIVE_HERO", BUY_GET: "BUY_GET_DEALS" } as const;

/** Home without the rows the hero cards already show, for the app and the website alike */
export function withoutHeroDuplicates<S extends Pick<HomeSection, "type">>(sections: S[]): S[] {
  const hero = sections.find((s) => s.type === "HERO_CARDS") as (S & { cards: { kind: string }[] }) | undefined;
  if (!hero) return sections;
  const shown = new Set<string>(hero.cards.flatMap((c) => (c.kind in STANDS_IN_FOR ? [STANDS_IN_FOR[c.kind as keyof typeof STANDS_IN_FOR]] : [])));
  return sections.filter((s) => !shown.has(s.type));
}
