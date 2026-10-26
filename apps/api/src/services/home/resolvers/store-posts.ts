import { storePosts } from "../../store-voice/posts.js";
import { sectionBase, type SectionResolver } from "../types.js";

// Builds before the scrolling row lay the post's products out in one fixed row, so `products` stays at what fits
// there; the rest go in `moreProducts` for the row that scrolls
const FIXED_ROW_TILES = 3;

/** The owner's newest live post, with how many more are live this week; hidden while there's none */
export const storePostsSection: SectionResolver = async (ctx, entry) => {
  const posts = await storePosts(ctx.prisma, ctx.store.id, { live: true });
  if (posts.length === 0) return null;
  const store = await ctx.prisma.store.findUnique({ where: { id: ctx.store.id }, select: { logoUrl: true } });
  const [latest, ...rest] = posts;
  return {
    ...sectionBase(entry),
    type: "STORE_POSTS",
    data: {
      post: { ...latest, products: latest.products.slice(0, FIXED_ROW_TILES), moreProducts: latest.products.slice(FIXED_ROW_TILES) },
      more: rest.length, logoUrl: store?.logoUrl ?? null,
    },
  };
};
