import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import type { ApiResponse } from "@martly/shared/types";
import { formatVariantUnit } from "./units.js";

/**
 * Checkout idempotency: the app sends one Idempotency-Key per checkout attempt and reuses it when it retries (a timeout,
 * a dropped connection). The key is stored on the order under a unique (user, key) index, so a repeat — even one racing
 * the first — gets the order already placed instead of a second one.
 */

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

type OrderReader = Pick<PrismaClient, "order">;

/** The request's Idempotency-Key; undefined when it sent none. A malformed key is a 400. */
export function idempotencyKeyOf(request: Pick<FastifyRequest, "headers">): string | undefined {
  const raw = request.headers["idempotency-key"];
  if (raw === undefined) return undefined;
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (!KEY_PATTERN.test(key)) {
    throw Object.assign(new Error("Idempotency-Key must be 16 to 128 letters, digits, '-' or '_'"), { statusCode: 400 });
  }
  return key;
}

/** Whether creating the order failed because another request with the same key placed it first */
export function isIdempotencyConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  return /idempotency/i.test(JSON.stringify(err.meta?.target ?? ""));
}

function findKeyedOrder(prisma: OrderReader, userId: string, key: string) {
  return prisma.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
    include: { items: { include: { variant: true } } },
  });
}

type KeyedOrder = NonNullable<Awaited<ReturnType<typeof findKeyedOrder>>>;

/** The body POST /orders answered with when it placed this order, rebuilt from the order */
export function placedOrderResponse(order: KeyedOrder) {
  const walletAmountUsed = Number(order.walletAmountUsed ?? 0);
  const loyaltyPointsUsed = order.loyaltyPointsUsed ?? 0;
  const remainingAmount = Number(order.totalAmount) - walletAmountUsed - loyaltyPointsUsed;
  const data = {
    ...order,
    items: order.items.map((item) => ({ ...item, variant: formatVariantUnit(item.variant) })),
    walletFullyCovered: remainingAmount === 0 && (walletAmountUsed > 0 || loyaltyPointsUsed > 0),
    walletAmountUsed,
    loyaltyPointsUsed,
    razorpayAmount: Math.round(remainingAmount * 100),
  };
  const response: ApiResponse<typeof data> = { success: true, data };
  return response;
}

/** preHandler for POST /orders: a key this user already placed an order with answers with that order */
export function replayPlacedOrder(prisma: OrderReader) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = idempotencyKeyOf(request);
    if (!key) return;
    const order = await findKeyedOrder(prisma, (request.user as { sub: string }).sub, key);
    if (order) return reply.send(placedOrderResponse(order));
  };
}

/** After an idempotency conflict: answers with the order the request that won the race placed */
export async function replayAfterConflict(prisma: OrderReader, request: FastifyRequest, reply: FastifyReply) {
  const key = idempotencyKeyOf(request)!;
  const order = await findKeyedOrder(prisma, (request.user as { sub: string }).sub, key);
  if (!order) return reply.conflict("This order is still being placed; try again in a moment");
  return reply.send(placedOrderResponse(order));
}
