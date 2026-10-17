import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ToolError } from "@anthropic-ai/sdk/lib/tools/ToolError";
import * as z from "zod/v4";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { searchProducts } from "../search.js";
import { orgSubcategoryCandidates } from "../seasonal/candidates.js";
import { describeProducts, onSaleProductIds, productLines, subcategoryProductIds } from "./catalog.js";

export const MIN_PRODUCTS = 6;
export const MAX_PRODUCTS = 24;
const SEARCH_LIMIT = 30;

const Copy = z.object({
  title: z.string().describe("2-5 words; include the offer when there is one, e.g. 'Paneer 5% Off'"),
  subtitle: z.string().describe("one line naming what's inside, under 45 characters"),
});

const SubmitSchema = z.object({
  productIds: z.array(z.string()).describe(`${MIN_PRODUCTS}-${MAX_PRODUCTS} product ids from tool results, best first`),
  discount: z.object({ type: z.enum(["PERCENTAGE", "FLAT"]), value: z.number().positive() }).nullable()
    .describe("only when the brief states a discount; FLAT is rupees off each item"),
  durationDays: z.number().int().min(1).max(30).describe("how long the promo runs; 7 unless the brief says otherwise"),
  copy: z.object({ en: Copy, ta: Copy.describe("natural everyday Tamil, not a literal translation") }),
  push: z.object({
    title: z.string().describe("push notification title, under 40 characters"),
    body: z.string().describe("push notification body, under 90 characters"),
  }),
  bannerScene: z.string().describe("the subject of the banner art (products, props, mood), without layout, style or text"),
  assumptions: z.array(z.string()).describe("short notes on what you assumed, e.g. 'Included paneer from all 3 brands'"),
});
export type PromoSubmission = z.infer<typeof SubmitSchema>;

export type AgentOutcome = { kind: "submitted"; promo: PromoSubmission } | { kind: "gave_up"; reason: string };

export interface ToolContext {
  prisma: PrismaClient;
  organizationId: string;
  storeId: string;
  brief: string;
  discountCap: number;
}

// The agent never invents or adjusts a discount: its value must be a number the brief states
const statedNumbers = (brief: string) => (brief.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

function rejectSubmission(ctx: ToolContext, seen: Set<string>, input: PromoSubmission) {
  const unknown = input.productIds.filter((id) => !seen.has(id));
  if (unknown.length) return `Unknown product ids (use ids from tool results only): ${unknown.join(", ")}`;
  const unique = new Set(input.productIds).size;
  if (unique < MIN_PRODUCTS || unique > MAX_PRODUCTS) return `Pick ${MIN_PRODUCTS}-${MAX_PRODUCTS} distinct products; you sent ${unique}.`;
  if (input.discount && !statedNumbers(ctx.brief).includes(input.discount.value)) {
    return "Use the discount exactly as the brief states it, or null when the brief states none.";
  }
  return null;
}

function overCap(ctx: ToolContext, discount: PromoSubmission["discount"]) {
  return discount?.type === "PERCENTAGE" && discount.value > ctx.discountCap
    ? `A ${discount.value}% discount is above this organisation's ${ctx.discountCap}% cap for promos.`
    : null;
}

type Show = (ids: string[]) => Promise<string>;

function catalogueTools(ctx: ToolContext, show: Show) {
  return [
    betaZodTool({
      name: "search_products",
      description: "Search the organisation's catalogue by product words, brand or attribute (e.g. 'paneer', 'cold pressed oil', 'herbal soap'). Returns up to 30 products.",
      inputSchema: z.object({ query: z.string() }),
      run: async ({ query }) => show((await searchProducts(ctx.prisma, ctx.storeId, query)).productIds.slice(0, SEARCH_LIMIT)),
    }),
    betaZodTool({
      name: "list_subcategories",
      description: "List in-stock subcategories (id | department > category > name (product count)) whose names contain the filter. An empty filter lists all.",
      inputSchema: z.object({ filter: z.string() }),
      run: async ({ filter }) => {
        const all = await orgSubcategoryCandidates(ctx.prisma, ctx.organizationId);
        const needle = filter.trim().toLowerCase();
        const hits = all.filter((c) => !needle || `${c.department} ${c.category} ${c.name}`.toLowerCase().includes(needle));
        return hits.map((c) => `${c.id} | ${c.department} > ${c.category} > ${c.name} (${c.products})`).join("\n") || "No subcategories match.";
      },
    }),
    betaZodTool({
      name: "browse_subcategory",
      description: "The best-selling in-stock products of one subcategory, by subcategory id.",
      inputSchema: z.object({ subcategoryId: z.string() }),
      run: async ({ subcategoryId }) => show(await subcategoryProductIds(ctx.prisma, ctx.organizationId, subcategoryId)),
    }),
    betaZodTool({
      name: "find_on_sale",
      description: "In-stock products that already have a live discount, most popular first. Use for deals briefs.",
      inputSchema: z.object({}),
      run: async () => show(await onSaleProductIds(ctx.prisma, ctx.organizationId)),
    }),
  ];
}

function outcomeTools(ctx: ToolContext, seen: Set<string>, record: (outcome: AgentOutcome) => void) {
  return [
    betaZodTool({
      name: "submit_promo",
      description: "Submit the finished promo. Call once, after choosing the products.",
      inputSchema: SubmitSchema,
      run: async (input) => {
        const problem = rejectSubmission(ctx, seen, input);
        if (problem) throw new ToolError(problem);
        const capped = overCap(ctx, input.discount);
        record(capped ? { kind: "gave_up", reason: capped } : { kind: "submitted", promo: { ...input, productIds: [...new Set(input.productIds)] } });
        return "Submitted. You're done.";
      },
    }),
    betaZodTool({
      name: "give_up",
      description: "Stop without a promo when the catalogue can't support the brief or the brief is unsafe. Explain why for the admin.",
      inputSchema: z.object({ reason: z.string() }),
      run: async ({ reason }) => {
        record({ kind: "gave_up", reason });
        return "Recorded.";
      },
    }),
  ];
}

/** The agent's catalogue tools; submit_promo or give_up records the outcome. */
export function promoTools(ctx: ToolContext) {
  const seen = new Set<string>();
  let outcome: AgentOutcome | null = null;
  const show: Show = async (ids) => {
    const products = await describeProducts(ctx.prisma, ctx.organizationId, ids);
    products.forEach((p) => seen.add(p.id));
    return productLines(products);
  };
  const tools = [...catalogueTools(ctx, show), ...outcomeTools(ctx, seen, (o) => { outcome = o; })];
  return { tools, outcome: () => outcome };
}
