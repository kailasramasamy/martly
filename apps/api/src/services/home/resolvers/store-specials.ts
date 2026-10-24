import { HOME_STORE_SPECIALS } from "@martly/shared/constants";
import { storeSpecials as stockedStoreSpecials } from "../../search-landing.js";
import { sectionBase, type SectionResolver } from "../types.js";

/** The store's own ranges it has in stock, drawn as the search screen's spotlight cards; nothing at other stores */
export const storeSpecials: SectionResolver = async (ctx, entry) => {
  const collections = await stockedStoreSpecials(ctx.prisma, ctx.store.id, ctx.store.organizationId, HOME_STORE_SPECIALS);
  return collections.length > 0 ? { ...sectionBase(entry), type: "STORE_SPECIALS", collections } : null;
};
