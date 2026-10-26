import { STOREFRONT_MIN } from "@martly/shared/constants";
import { flag, fromCount, type CheckContext } from "./context.js";

/** Logo, cover, tagline, highlights and posters: what the store card and the top of the app show */
export async function looksChecks({ store }: CheckContext) {
  return [
    flag("LOGO", !!store.logoUrl),
    flag("COVER", !!store.imageUrl),
    flag("TAGLINE", !!store.tagline?.trim()),
    fromCount("HIGHLIGHTS", store.highlights.filter((h) => h.trim()).length, STOREFRONT_MIN.HIGHLIGHTS),
    flag("POSTERS", store.promoImages.length > 0),
  ];
}
