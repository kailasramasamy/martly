import type { HeroCardTheme } from "@martly/shared/constants";
import type { HomeTheme } from "@martly/shared/types";
import type { MobileHomeSection } from "../../../lib/use-home-sections";

/** A hero card's colours as the header's theme: it floats over the card's wash in the card's ink */
export function heroHeaderTheme(theme: HeroCardTheme): HomeTheme {
  return { background: theme.tint, title: theme.ink, dark: false };
}

// The row a hero card stands in for; the server still sends these for app builds without the hero cards
const STANDS_IN_FOR = { FESTIVE: "FESTIVE_HERO", BUY_GET: "BUY_GET_DEALS" } as const;

/** Home without the rows the hero cards already show */
export function withoutHeroDuplicates(sections: MobileHomeSection[]) {
  const hero = sections.find((s) => s.type === "HERO_CARDS");
  if (!hero || hero.type !== "HERO_CARDS") return sections;
  const shown = new Set<string>(hero.cards.flatMap((c) => (c.kind in STANDS_IN_FOR ? [STANDS_IN_FOR[c.kind as keyof typeof STANDS_IN_FOR]] : [])));
  return sections.filter((s) => !shown.has(s.type));
}
