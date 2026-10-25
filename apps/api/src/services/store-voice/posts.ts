import type { CreateStorePostInput, UpdateStorePostInput } from "@martly/shared/schemas";
import type { StorePostView, VoiceTranslations } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { addDays, istDay, istNow } from "../ist-day.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "../store-product-view.js";
import { languageOf } from "../translate/store-voice.js";
import { firstName } from "./picks.js";

// How long a post shows when the owner doesn't say: fresh stock is today's news, new arrivals last a week
const DEFAULT_DAYS = { FRESH_TODAY: 0, BACK_IN_STOCK: 3, NEW_IN_STORE: 7 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;
// The shop's board shows posts from this many days back that are still live; the owner's list goes back further
const RECENT_DAYS = 7;
const MANAGE_DAYS = 30;

/** The end of the IST day `days` from today: a post for today only runs to midnight */
export function expiryAfter(days: number) {
  return istDay(addDays(istNow().key, days)).end;
}

const postInclude = {
  author: { select: { name: true } },
  products: { orderBy: { position: "asc" as const }, select: { productId: true } },
};

type PostRow = NonNullable<Awaited<ReturnType<typeof loadPosts>>>[number];

function loadPosts(prisma: PrismaClient, where: { storeId: string; live: boolean }) {
  return prisma.storePost.findMany({
    where: {
      storeId: where.storeId,
      ...(where.live ? { expiresAt: { gt: new Date() } } : { createdAt: { gte: new Date(Date.now() - MANAGE_DAYS * DAY_MS) } }),
    },
    orderBy: { createdAt: "desc" },
    include: postInclude,
  });
}

// Each tagged product as the store sells it now: its cheapest in-stock size, in the order the owner tagged them
async function productsFor(prisma: PrismaClient, storeId: string, posts: PostRow[]) {
  const ids = [...new Set(posts.flatMap((p) => p.products.map((pp) => pp.productId)))];
  const rows = await prisma.storeProduct.findMany({
    where: { storeId, productId: { in: ids }, isActive: true, stock: { gt: 0 }, product: { isActive: true } },
    include: storeProductInclude,
    orderBy: { price: "asc" },
  });
  const cheapest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!cheapest.has(row.productId) && row.stock > row.reservedStock) cheapest.set(row.productId, row);
  const views = await decorateStoreProducts(prisma, [...cheapest.values()]);
  return new Map(views.map((v) => [v.productId, v]));
}

function postView(post: PostRow, listings: Map<string, StoreProductView>): StorePostView<StoreProductView> {
  return {
    id: post.id, kind: post.kind, text: post.text, language: post.language,
    translations: post.translations as VoiceTranslations | null, author: firstName(post.author.name),
    createdAt: post.createdAt.toISOString(), expiresAt: post.expiresAt.toISOString(),
    products: post.products.flatMap((pp) => listings.get(pp.productId) ?? []),
  };
}

/** Live posts for shoppers (newest first, from the last week), or every recent one for the owner's list */
export async function storePosts(prisma: PrismaClient, storeId: string, { live }: { live: boolean }) {
  const all = await loadPosts(prisma, { storeId, live });
  const posts = live ? all.filter((p) => p.createdAt.getTime() > Date.now() - RECENT_DAYS * DAY_MS) : all;
  const listings = await productsFor(prisma, storeId, posts);
  return posts.map((p) => postView(p, listings));
}

/** Saves a post; null when a tagged product isn't listed at the store */
export async function createStorePost(prisma: PrismaClient, authorId: string, input: CreateStorePostInput) {
  const listed = await prisma.storeProduct.findMany({
    where: { storeId: input.storeId, productId: { in: input.productIds }, isActive: true },
    distinct: ["productId"], select: { productId: true },
  });
  if (listed.length !== new Set(input.productIds).size) return null;
  return prisma.storePost.create({
    data: {
      storeId: input.storeId, authorId, kind: input.kind, text: input.text, language: languageOf(input.text),
      ...(input.translations ? { translations: input.translations } : {}),
      expiresAt: expiryAfter(input.days ?? DEFAULT_DAYS[input.kind]),
      products: { create: [...new Set(input.productIds)].map((productId, position) => ({ productId, position })) },
    },
  });
}

/** One post for the owner to edit, with every tagged product (in stock or not) */
export async function postForEdit(prisma: PrismaClient, id: string) {
  const post = await prisma.storePost.findUnique({
    where: { id },
    include: { products: { orderBy: { position: "asc" }, select: { product: { select: { id: true, name: true, imageUrl: true } } } } },
  });
  if (!post) return null;
  const { products, ...rest } = post;
  return { ...rest, products: products.map((p) => p.product) };
}

/**
 * Saves an owner's changes to a post. New words are written in their own language and translated again; false when a
 * tagged product isn't listed at the post's store
 */
export async function updateStorePost(prisma: PrismaClient, post: { id: string; storeId: string; text: string }, input: UpdateStorePostInput) {
  const ids = [...new Set(input.productIds)];
  const listed = await prisma.storeProduct.findMany({
    where: { storeId: post.storeId, productId: { in: ids }, isActive: true }, distinct: ["productId"], select: { productId: true },
  });
  if (listed.length !== ids.length) return false;
  const reworded = input.text !== post.text;
  await prisma.$transaction([
    prisma.storePostProduct.deleteMany({ where: { postId: post.id } }),
    prisma.storePost.update({
      where: { id: post.id },
      data: {
        kind: input.kind, text: input.text,
        ...(reworded ? { language: languageOf(input.text), translations: Prisma.DbNull } : {}),
        // What the owner checked in the form wins over any earlier translation
        ...(input.translations ? { translations: input.translations } : {}),
        ...(input.days !== undefined ? { expiresAt: expiryAfter(input.days) } : {}),
        products: { create: ids.map((productId, position) => ({ productId, position })) },
      },
    }),
  ]);
  return true;
}
