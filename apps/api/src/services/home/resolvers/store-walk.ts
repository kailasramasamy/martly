import { walkTeaser } from "../../store-walk.js";
import { sectionBase, type SectionResolver } from "../types.js";

// A walk through one or two aisles isn't a walk
const MIN_AISLES = 3;

/** The "Walk the store" card: the department a walk starts in, its aisles, and how many usual items are due */
export const storeWalk: SectionResolver = async (ctx, entry) => {
  const teaser = await walkTeaser(ctx.prisma, ctx.store.id, ctx.userId || null);
  if (!teaser || teaser.aisleCount < MIN_AISLES) return null;
  return { ...sectionBase(entry), type: "STORE_WALK", data: teaser };
};
