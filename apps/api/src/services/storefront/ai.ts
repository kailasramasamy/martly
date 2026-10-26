import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { PrismaClient } from "../../../generated/prisma/client.js";

const MODEL = "claude-haiku-5-5";
const DAY_MS = 86_400_000;
const POST_PRODUCTS = 6;
const PICKS = 6;
const MIN_PICK_STOCK = 10;
// Departments whose stock changes daily, for a "Fresh today" post
const FRESH_DEPARTMENTS = ["fruit", "vegetable", "dairy", "bakery", "meat", "fish"];

const STYLE = `You write for a neighbourhood grocery shop's app in Tamil Nadu, India.
- Warm, plain, local; the shopkeeper's own voice. No hype, no emojis, no exclamation marks in a row.
- Tamil is natural everyday Tamil, not a literal translation.
- Never invent prices, discounts or claims the facts don't support.`;

class AiUnavailableError extends Error {
  statusCode = 503;
  constructor() { super("AI drafting isn't available right now"); }
}

async function ask<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError();
  const response = await new Anthropic().beta.messages.parse({
    model: MODEL, max_tokens: 1500, system: STYLE,
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  }).catch((err: unknown) => {
    if (err instanceof Anthropic.APIError) throw new AiUnavailableError();
    throw err;
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new AiUnavailableError();
  return response.parsed_output;
}

// The store's biggest departments by products listed, for prompts
async function topDepartments(prisma: PrismaClient, storeId: string) {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT d.name FROM store_products sp
    JOIN products p ON p.id = sp.product_id JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id JOIN departments d ON d.id = c.department_id
    WHERE sp.store_id = ${storeId} AND sp.is_active GROUP BY d.name ORDER BY COUNT(*) DESC LIMIT 5`;
  return rows.map((r) => r.name);
}

const Bilingual = z.object({ en: z.string(), ta: z.string() });
const BrandingSchema = z.object({
  tagline: Bilingual.describe("One line under the shop's name, at most 45 characters in English"),
  highlights: z.array(z.string().describe("English, 2 to 3 words, at most 24 characters")).length(3),
});
export type BrandingDraft = z.infer<typeof BrandingSchema>;

/** A tagline and three highlights for the store card, from what the store actually sells */
export async function draftBranding(prisma: PrismaClient, storeId: string): Promise<BrandingDraft> {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { name: true, address: true, freeDeliveryThreshold: true, expressDeliveryConfig: { select: { isEnabled: true } } },
  });
  const departments = await topDepartments(prisma, storeId);
  const facts = [
    `Shop: ${store.name}`, `Address: ${store.address}`, `Sells most in: ${departments.join(", ")}`,
    store.expressDeliveryConfig?.isEnabled ? "Offers express delivery" : null,
    store.freeDeliveryThreshold ? `Free delivery above ₹${Number(store.freeDeliveryThreshold)}` : null,
  ].filter(Boolean).join("\n");
  return ask(BrandingSchema, `Write a tagline and three highlights for this shop's card in the app.
- Tagline: one short line, at most 45 characters in English.
- Highlights: English chips of 2 or 3 words, at most 24 characters, like "Fresh produce", "Express delivery", "Free delivery ₹299+". Never a sentence.

${facts}`);
}

const PostSchema = z.object({ en: z.string().describe("At most 150 characters"), ta: z.string() });
type PostKind = "NEW_IN_STORE" | "FRESH_TODAY";

// Recently listed products in stock, else in-stock products from the fresh departments
async function postProducts(prisma: PrismaClient, storeId: string): Promise<{ kind: PostKind; products: { id: string; name: string; imageUrl: string | null }[] }> {
  const inStock = { storeId, isActive: true, stock: { gt: 0 } };
  const select = { product: { select: { id: true, name: true, imageUrl: true } } } as const;
  const recent = await prisma.storeProduct.findMany({
    where: { ...inStock, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } }, select, take: POST_PRODUCTS, distinct: ["productId"],
  });
  if (recent.length >= 3) return { kind: "NEW_IN_STORE", products: recent.map((r) => r.product) };
  const fresh = await prisma.storeProduct.findMany({
    where: { ...inStock, product: { subcategory: { category: { department: { OR: FRESH_DEPARTMENTS.map((d) => ({ name: { contains: d, mode: "insensitive" as const } })) } } } } },
    select, take: POST_PRODUCTS, distinct: ["productId"], orderBy: { stock: "desc" },
  });
  return { kind: "FRESH_TODAY", products: fresh.map((r) => r.product) };
}

/** A "From the shop" post about what's new or fresh, with its products, in English and Tamil */
export async function draftPost(prisma: PrismaClient, storeId: string) {
  const { kind, products } = await postProducts(prisma, storeId);
  const about = kind === "NEW_IN_STORE" ? "new products that just arrived" : "fresh stock in today";
  const text = await ask(PostSchema, `Write a short post from the shopkeeper to customers about ${about}.
- Two or three short lines, at most 150 characters in English.
- Name one or two of the products at most, in plain words; the products show as pictures under the post.
Products: ${products.map((p) => p.name).join(", ") || "(general fresh stock)"}`);
  return { kind, text: text.en, translations: { ta: { text: text.ta } }, products };
}

type PickRow = { id: string; name: string; size: string; price: unknown; image_url: string | null };

/**
 * Well-stocked listings that haven't sold in 30 days and carry no offer: the first few suit Buy 2 Get 1, the next few
 * 10% off. No AI model: it's the store's own sales and stock.
 */
export async function draftOfferPicks(prisma: PrismaClient, storeId: string) {
  const rows = await prisma.$queryRaw<PickRow[]>`
    SELECT sp.id, p.name, v.name AS size, sp.price, p.image_url FROM store_products sp
    JOIN products p ON p.id = sp.product_id JOIN product_variants v ON v.id = sp.variant_id
    WHERE sp.store_id = ${storeId} AND sp.is_active AND sp.stock - sp.reserved_stock >= ${MIN_PICK_STOCK}
      AND sp.offer_buy_qty IS NULL AND sp.discount_type IS NULL
      AND NOT EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.store_product_id = sp.id AND o.created_at >= ${new Date(Date.now() - 30 * DAY_MS)})
    ORDER BY sp.stock - sp.reserved_stock DESC LIMIT ${PICKS * 2}`;
  const listings = rows.map((r) => ({ id: r.id, name: r.name, size: r.size, price: Number(r.price), imageUrl: r.image_url }));
  return {
    buyGet: { buy: 2, get: 1, listings: listings.slice(0, PICKS) },
    discount: { discountType: "PERCENTAGE" as const, discountValue: 10, listings: listings.slice(PICKS) },
  };
}
