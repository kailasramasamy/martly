import { storePosts } from "../../store-voice/posts.js";
import { sectionBase, type SectionResolver } from "../types.js";

// Product tiles under the post on Home; the shop's board shows them all
const HOME_TILES = 3;

/** The owner's newest live post, with how many more are live this week; hidden while there's none */
export const storePostsSection: SectionResolver = async (ctx, entry) => {
  const posts = await storePosts(ctx.prisma, ctx.store.id, { live: true });
  if (posts.length === 0) return null;
  const store = await ctx.prisma.store.findUnique({ where: { id: ctx.store.id }, select: { logoUrl: true } });
  const [latest, ...rest] = posts;
  return {
    ...sectionBase(entry),
    type: "STORE_POSTS",
    data: { post: { ...latest, products: latest.products.slice(0, HOME_TILES) }, more: rest.length, logoUrl: store?.logoUrl ?? null },
  };
};
