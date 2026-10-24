import { HOME_BUY_GET_ROW } from "@martly/shared/constants";
import { buyGetRow } from "../buy-get.js";
import { sectionBase, type SectionResolver } from "../types.js";

/** The store's buy X get Y offers as a row; nothing when it runs none */
export const buyGetDeals: SectionResolver = async (ctx, entry) => {
  const { products, total } = await buyGetRow(ctx.prisma, ctx.store.id, ctx.now, HOME_BUY_GET_ROW);
  return products.length > 0 ? { ...sectionBase(entry), type: "BUY_GET_DEALS", products, total } : null;
};
