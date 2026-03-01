import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate } from "../../middleware/auth.js";
import { calculateEffectivePrice } from "../../services/pricing.js";
import { formatVariantUnit } from "../../services/units.js";
import type { ApiResponse } from "@martly/shared/types";

// ── Rate Limiter ────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

// ── Tool Definitions ────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "search_products",
    description:
      "Search for products available in the store. Use this to find products matching what the customer asks for. Always search before suggesting products.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term (product name, brand, or category). Examples: 'milk', 'Maggi noodles', 'rice 5kg'",
        },
        categoryId: {
          type: "string",
          description: "Optional category ID to filter results. Get category IDs from get_categories tool first.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_categories",
    description: "Get all top-level product categories available in the store. Use this when customer asks to browse categories or wants to see what's available.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_product_details",
    description:
      "Get detailed information about a specific product including all available variants (sizes/packs). Use when customer wants to see options for a specific product.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: {
          type: "string",
          description: "The product ID to get details for",
        },
      },
      required: ["productId"],
    },
  },
];

// ── Tool Executors ──────────────────────────────────
async function executeSearchProducts(
  prisma: FastifyInstance["prisma"],
  storeId: string,
  input: { query: string; categoryId?: string },
) {
  const where: Record<string, unknown> = {
    storeId,
    isActive: true,
    stock: { gt: 0 },
    product: {
      isActive: true,
      name: { contains: input.query, mode: "insensitive" },
    },
  };

  if (input.categoryId) {
    // Include descendant categories
    const allCats = await prisma.category.findMany({ select: { id: true, parentId: true } });
    const descendantIds = new Set<string>([input.categoryId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cat of allCats) {
        if (cat.parentId && descendantIds.has(cat.parentId) && !descendantIds.has(cat.id)) {
          descendantIds.add(cat.id);
          changed = true;
        }
      }
    }
    (where.product as Record<string, unknown>).categoryId = { in: Array.from(descendantIds) };
  }

  const storeProducts = await prisma.storeProduct.findMany({
    where,
    take: 10,
    include: {
      product: { include: { category: true, brand: true } },
      variant: true,
    },
    orderBy: { product: { name: "asc" } },
  });

  return storeProducts.map((sp) => {
    const pricing = calculateEffectivePrice(
      sp.price as unknown as number,
      sp.variant as Parameters<typeof calculateEffectivePrice>[1],
      sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
    );
    const variant = formatVariantUnit(sp.variant);
    return {
      storeProductId: sp.id,
      productId: sp.productId,
      name: sp.product.name,
      brand: sp.product.brand?.name ?? null,
      category: sp.product.category?.name ?? null,
      variant: variant.name,
      unitType: variant.unitType,
      unitValue: (variant as Record<string, unknown>).unitValue as string,
      price: pricing.effectivePrice,
      originalPrice: pricing.discountActive ? pricing.originalPrice : null,
      inStock: sp.stock - sp.reservedStock > 0,
      imageUrl: sp.product.imageUrl ?? variant.imageUrl,
    };
  });
}

async function executeGetCategories(prisma: FastifyInstance["prisma"]) {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  return categories;
}

async function executeGetProductDetails(
  prisma: FastifyInstance["prisma"],
  storeId: string,
  input: { productId: string },
) {
  const storeProducts = await prisma.storeProduct.findMany({
    where: {
      storeId,
      productId: input.productId,
      isActive: true,
    },
    include: {
      product: { include: { category: true, brand: true } },
      variant: true,
    },
  });

  if (storeProducts.length === 0) return null;

  const product = storeProducts[0].product;
  const variants = storeProducts.map((sp) => {
    const pricing = calculateEffectivePrice(
      sp.price as unknown as number,
      sp.variant as Parameters<typeof calculateEffectivePrice>[1],
      sp as unknown as Parameters<typeof calculateEffectivePrice>[2],
    );
    const variant = formatVariantUnit(sp.variant);
    return {
      storeProductId: sp.id,
      variantName: variant.name,
      unitType: variant.unitType,
      unitValue: (variant as Record<string, unknown>).unitValue as string,
      price: pricing.effectivePrice,
      originalPrice: pricing.discountActive ? pricing.originalPrice : null,
      inStock: sp.stock - sp.reservedStock > 0,
    };
  });

  return {
    productId: product.id,
    name: product.name,
    description: product.description,
    brand: product.brand?.name ?? null,
    category: product.category?.name ?? null,
    imageUrl: product.imageUrl,
    variants,
  };
}

// ── System Prompt Builder ───────────────────────────
function buildSystemPrompt(
  storeName: string,
  cart: { productName: string; variantName: string; quantity: number; price: number }[],
): string {
  const cartSummary =
    cart.length > 0
      ? `\n\nCustomer's current cart:\n${cart.map((item) => `- ${item.productName} (${item.variantName}) x${item.quantity} = \u20B9${item.price * item.quantity}`).join("\n")}\nTotal: \u20B9${cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}`
      : "\n\nCustomer's cart is empty.";

  return `You are Martly, a friendly grocery shopping assistant for ${storeName}.

RULES:
1. ONLY help with grocery shopping. Politely redirect non-grocery questions.
2. ALWAYS use search_products tool before suggesting products. Never guess names or prices.
3. Keep your message SHORT (1-2 sentences). No markdown. No bullet points.
4. When customer asks for items, search and return results in the products array.
5. When asked about cart, summarize from the cart context below.
6. If search returns no results, suggest alternatives.
7. Use get_categories when customer wants to browse categories.
8. Use get_product_details for variant options of a specific product.
${cartSummary}

CRITICAL: Your entire response must be a single valid JSON object. No text before or after. No markdown code fences. Just raw JSON:
{"message":"your short response","products":[{"storeProductId":"id","productId":"pid","name":"Name","brand":"Brand","variant":"500g","price":120,"originalPrice":150,"inStock":true,"imageUrl":"url"}],"actions":[]}

Copy product fields EXACTLY from tool results. products=[] if nothing to show. actions=[] always.`;
}

// ── Route ───────────────────────────────────────────
export async function aiRoutes(app: FastifyInstance) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  app.post<{
    Body: {
      storeId: string;
      messages: { role: "user" | "assistant"; content: string }[];
      cart: { productName: string; variantName: string; quantity: number; price: number }[];
    };
  }>("/chat", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    if (!checkRateLimit(user.sub)) {
      return reply.tooManyRequests("Too many requests. Please wait a moment.");
    }

    const { storeId, messages, cart } = request.body;

    if (!storeId || !messages || messages.length === 0) {
      return reply.badRequest("storeId and messages are required");
    }

    // Validate store exists
    const store = await app.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, status: true },
    });

    if (!store || store.status !== "ACTIVE") {
      return reply.notFound("Store not found or inactive");
    }

    // Trim to last 20 messages
    const trimmedMessages = messages.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemPrompt = buildSystemPrompt(store.name, cart ?? []);

    // ── Claude tool-use loop (max 5 iterations) ──
    let claudeMessages: Anthropic.MessageParam[] = trimmedMessages;
    let finalText = "";
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });

      // Collect text and tool use blocks
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (textBlocks.length > 0) {
        finalText = textBlocks.map((b) => b.text).join("");
      }

      // If no tool calls, we're done
      if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
        break;
      }

      // Execute tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        let result: unknown;

        try {
          switch (toolUse.name) {
            case "search_products":
              result = await executeSearchProducts(
                app.prisma,
                storeId,
                toolUse.input as { query: string; categoryId?: string },
              );
              break;
            case "get_categories":
              result = await executeGetCategories(app.prisma);
              break;
            case "get_product_details":
              result = await executeGetProductDetails(
                app.prisma,
                storeId,
                toolUse.input as { productId: string },
              );
              break;
            default:
              result = { error: "Unknown tool" };
          }
        } catch (err) {
          result = { error: "Failed to execute tool" };
          app.log.error(err, `AI tool execution failed: ${toolUse.name}`);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Add assistant response + tool results to messages for next iteration
      claudeMessages = [
        ...claudeMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    // Parse the JSON response from Claude
    let parsed: { message: string; products: unknown[]; actions: unknown[] };

    try {
      // Try to extract JSON from the response (handle cases where Claude adds extra text)
      const jsonMatch = finalText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { message: finalText || "I couldn't process that. Could you try again?", products: [], actions: [] };
      }
    } catch {
      parsed = { message: finalText || "I couldn't process that. Could you try again?", products: [], actions: [] };
    }

    const apiResponse: ApiResponse<typeof parsed> = {
      success: true,
      data: {
        message: parsed.message ?? "",
        products: parsed.products ?? [],
        actions: parsed.actions ?? [],
      },
    };

    return apiResponse;
  });
}
