import type { HeroCardTheme } from "@martly/shared/constants";
import type { HomeTheme } from "@martly/shared/types";

/** A hero card's colours as the header's theme: it floats over the card's wash in the card's ink */
export function heroHeaderTheme(theme: HeroCardTheme): HomeTheme {
  return { background: theme.tint, title: theme.ink, dark: false };
}
