import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgStoreIds } from "../../middleware/org-scope.js";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";

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

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

// ── Tool Definitions ────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "get_order_details",
    description:
      "Look up a specific order by ID. Returns order status, items, payment info, and delivery details. Use when the customer asks about a specific order.",
    input_schema: {
      type: "object" as const,
      properties: {
        orderId: {
          type: "string",
          description: "The order ID to look up",
        },
      },
      required: ["orderId"],
    },
  },
  {
    name: "get_my_orders",
    description:
      "List the customer's recent orders (last 10). Use when the customer asks about their orders, order history, or wants to check on a delivery.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_store_info",
    description:
      "Get store details including name, address, and phone number. Use when customer asks about the store, contact info, or location.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "create_ticket",
    description:
      "Escalate the conversation to a human support agent by creating a support ticket. Use when you cannot resolve the issue, the customer explicitly asks to speak to a human, or the problem requires manual intervention (refunds, account issues, complaints).",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: {
          type: "string",
          description: "Brief subject line for the ticket (e.g., 'Missing items in order #abc123')",
        },
        summary: {
          type: "string",
          description: "Summary of the customer's issue and what has been discussed so far",
        },
      },
      required: ["subject", "summary"],
    },
  },
];

// ── Tool Executors ──────────────────────────────────
async function executeGetOrderDetails(
  prisma: FastifyInstance["prisma"],
  userId: string,
  input: { orderId: string },
) {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, userId },
    include: {
      store: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true } },
          variant: { select: { name: true, unitType: true, unitValue: true } },
        },
      },
    },
  });

  if (!order) return { error: "Order not found or does not belong to you" };

  return {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalAmount: Number(order.totalAmount),
    deliveryFee: Number(order.deliveryFee),
    couponDiscount: order.couponDiscount ? Number(order.couponDiscount) : null,
    walletAmountUsed: order.walletAmountUsed ? Number(order.walletAmountUsed) : null,
    deliveryAddress: order.deliveryAddress,
    storeName: order.store.name,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      name: item.product.name,
      variant: item.variant?.name ?? "",
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
  };
}

async function executeGetMyOrders(
  prisma: FastifyInstance["prisma"],
  userId: string,
) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      store: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
    },
  });

  return orders.map((order) => ({
    orderId: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: Number(order.totalAmount),
    storeName: order.store.name,
    itemCount: order.items.length,
    itemSummary: order.items.slice(0, 3).map((i) => i.product.name).join(", "),
    createdAt: order.createdAt.toISOString(),
  }));
}

async function executeGetStoreInfo(
  prisma: FastifyInstance["prisma"],
  storeId: string,
) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, address: true, phone: true },
  });
  if (!store) return { error: "Store not found" };
  return store;
}

async function executeCreateTicket(
  prisma: FastifyInstance["prisma"],
  userId: string,
  storeId: string | null,
  orderId: string | null,
  conversationMessages: { role: string; content: string; timestamp: string }[],
  input: { subject: string; summary: string },
) {
  // Look up store to get organizationId
  let organizationId: string | null = null;
  if (storeId) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { organizationId: true },
    });
    if (store) organizationId = store.organizationId;
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      storeId,
      orderId,
      subject: input.subject,
      messages: conversationMessages,
      organizationId,
    },
  });

  return { ticketId: ticket.id, subject: input.subject };
}

// ── System Prompt ───────────────────────────────────
function buildSupportSystemPrompt(storeName: string, orderId?: string): string {
  const orderContext = orderId
    ? `\n\nThe customer is asking about a specific order. Use get_order_details with orderId "${orderId}" to look it up first before responding.`
    : "";

  return `You are Martly Support, a helpful customer support assistant for ${storeName}.

RULES:
1. Help customers with order issues, delivery questions, payment problems, and general inquiries.
2. ALWAYS use tools to look up real data. Never guess order statuses, amounts, or details.
3. Keep responses SHORT and friendly (2-3 sentences max). No markdown formatting.
4. If you cannot resolve the issue or the customer asks to speak to a human, use the create_ticket tool to escalate.
5. Be empathetic and professional. Acknowledge the customer's frustration when appropriate.
6. For refund requests, account issues, or complaints — always escalate via create_ticket.
7. You can look up orders, check delivery status, and provide store contact info.
8. Do NOT make promises about refunds, compensation, or policy exceptions — escalate those to human agents.${orderContext}

Your response must be a single valid JSON object with no text before or after:
{"message":"your response text"}`;
}

// ── Route ───────────────────────────────────────────
export async function supportRoutes(app: FastifyInstance) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // ── POST /chat — AI support chat ──
  app.post<{
    Body: {
      storeId: string;
      messages: { role: "user" | "assistant"; content: string }[];
      orderId?: string;
    };
  }>("/chat", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string };
    if (!checkRateLimit(user.sub)) {
      return reply.tooManyRequests("Too many requests. Please wait a moment.");
    }

    const { storeId, messages, orderId } = request.body;

    if (!storeId || !messages || messages.length === 0) {
      return reply.badRequest("storeId and messages are required");
    }

    const store = await app.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, status: true },
    });

    if (!store || store.status !== "ACTIVE") {
      return reply.notFound("Store not found or inactive");
    }

    // Verify orderId belongs to this user if provided
    if (orderId) {
      const order = await app.prisma.order.findFirst({
        where: { id: orderId, userId: user.sub },
        select: { id: true },
      });
      if (!order) {
        return reply.notFound("Order not found");
      }
    }

    const trimmedMessages = messages.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemPrompt = buildSupportSystemPrompt(store.name, orderId);

    let claudeMessages: Anthropic.MessageParam[] = trimmedMessages;
    let finalText = "";
    let ticketCreated = false;
    let ticketId: string | undefined;
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (textBlocks.length > 0) {
        finalText = textBlocks.map((b) => b.text).join("");
      }

      if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        let result: unknown;

        try {
          switch (toolUse.name) {
            case "get_order_details":
              result = await executeGetOrderDetails(
                app.prisma,
                user.sub,
                toolUse.input as { orderId: string },
              );
              break;
            case "get_my_orders":
              result = await executeGetMyOrders(app.prisma, user.sub);
              break;
            case "get_store_info":
              result = await executeGetStoreInfo(app.prisma, storeId);
              break;
            case "create_ticket": {
              // Build conversation history for the ticket
              const conversationMessages = trimmedMessages.map((m) => ({
                role: m.role,
                content: m.content,
                timestamp: new Date().toISOString(),
              }));
              const ticketResult = await executeCreateTicket(
                app.prisma,
                user.sub,
                storeId,
                orderId ?? null,
                conversationMessages,
                toolUse.input as { subject: string; summary: string },
              );
              ticketCreated = true;
              ticketId = ticketResult.ticketId;
              result = ticketResult;
              break;
            }
            default:
              result = { error: "Unknown tool" };
          }
        } catch (err) {
          result = { error: "Failed to execute tool" };
          app.log.error(err, `Support tool execution failed: ${toolUse.name}`);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      claudeMessages = [
        ...claudeMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    // Parse the JSON response
    let message: string;
    try {
      const jsonMatch = finalText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        message = parsed.message ?? finalText;
      } else {
        message = finalText || "I'm sorry, I couldn't process that. Could you try again?";
      }
    } catch {
      message = finalText || "I'm sorry, I couldn't process that. Could you try again?";
    }

    return {
      success: true,
      data: { message, ticketCreated, ticketId },
    } satisfies ApiResponse<{ message: string; ticketCreated: boolean; ticketId?: string }>;
  });

  // ── GET /my-tickets — Customer's own tickets ──
  app.get("/my-tickets", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    const tickets = await app.prisma.supportTicket.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: "desc" },
      include: {
        store: { select: { id: true, name: true } },
        order: { select: { id: true, status: true } },
      },
    });
    return { success: true, data: tickets } satisfies ApiResponse<typeof tickets>;
  });

  // ── GET /tickets/stats — Admin ticket stats (org-scoped) ──
  app.get(
    "/tickets/stats",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request) => {
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      const storeFilter: Record<string, unknown> = {};
      if (orgStoreIds) storeFilter.storeId = { in: orgStoreIds };

      const [total, open, resolved, closed] = await Promise.all([
        app.prisma.supportTicket.count({ where: storeFilter }),
        app.prisma.supportTicket.count({ where: { ...storeFilter, status: "OPEN" } }),
        app.prisma.supportTicket.count({ where: { ...storeFilter, status: "RESOLVED" } }),
        app.prisma.supportTicket.count({ where: { ...storeFilter, status: "CLOSED" } }),
      ]);

      return { success: true, data: { total, open, resolved, closed } } satisfies ApiResponse<{
        total: number; open: number; resolved: number; closed: number;
      }>;
    },
  );

  // ── GET /tickets — Admin list (paginated, org-scoped) ──
  app.get<{
    Querystring: {
      page?: string;
      pageSize?: string;
      status?: string;
      storeId?: string;
      search?: string;
    };
  }>(
    "/tickets",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request) => {
      const { page = "1", pageSize = "20", status, storeId, search } = request.query as {
        page?: string;
        pageSize?: string;
        status?: string;
        storeId?: string;
        search?: string;
      };
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const orgStoreIds = await getOrgStoreIds(request, app.prisma);

      const where: Record<string, unknown> = {};

      // Org-scope: only tickets for stores the user can access
      if (orgStoreIds) {
        where.storeId = { in: orgStoreIds };
      }

      if (status) where.status = status;
      if (storeId) where.storeId = storeId;
      if (search) {
        where.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [tickets, total] = await Promise.all([
        app.prisma.supportTicket.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            store: { select: { id: true, name: true } },
            order: { select: { id: true, status: true, totalAmount: true } },
          },
        }),
        app.prisma.supportTicket.count({ where }),
      ]);

      return {
        success: true,
        data: tickets,
        meta: {
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / take),
        },
      } satisfies PaginatedResponse<(typeof tickets)[0]>;
    },
  );

  // ── GET /tickets/:id — Admin detail ──
  app.get<{ Params: { id: string } }>(
    "/tickets/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")] },
    async (request, reply) => {
      const { id } = request.params;

      const ticket = await app.prisma.supportTicket.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          store: { select: { id: true, name: true } },
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
      });

      if (!ticket) return reply.notFound("Ticket not found");

      // Org-scope check
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      if (orgStoreIds && ticket.storeId && !orgStoreIds.includes(ticket.storeId)) {
        return reply.forbidden("Access denied");
      }

      return { success: true, data: ticket } satisfies ApiResponse<typeof ticket>;
    },
  );

  // ── PATCH /tickets/:id — Update status + admin reply ──
  app.patch<{
    Params: { id: string };
    Body: { status?: string; reply?: string };
  }>(
    "/tickets/:id",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      const { id } = request.params;
      const { status, reply: adminReply } = request.body;

      const ticket = await app.prisma.supportTicket.findUnique({
        where: { id },
      });

      if (!ticket) return reply.notFound("Ticket not found");

      // Org-scope check
      const orgStoreIds = await getOrgStoreIds(request, app.prisma);
      if (orgStoreIds && ticket.storeId && !orgStoreIds.includes(ticket.storeId)) {
        return reply.forbidden("Access denied");
      }

      const updates: Record<string, unknown> = {};

      if (status) {
        updates.status = status;
      }

      if (adminReply) {
        const currentMessages = (ticket.messages as { role: string; content: string; timestamp: string }[]) || [];
        currentMessages.push({
          role: "admin",
          content: adminReply,
          timestamp: new Date().toISOString(),
        });
        updates.messages = currentMessages;
      }

      const updated = await app.prisma.supportTicket.update({
        where: { id },
        data: updates,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          store: { select: { id: true, name: true } },
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
      });

      return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
    },
  );
}
