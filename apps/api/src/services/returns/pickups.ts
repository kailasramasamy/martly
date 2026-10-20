import type { PrismaClient } from "../../../generated/prisma/client.js";
import { hasPermission } from "@martly/shared/permissions";
import { Permission } from "@martly/shared/constants";
import type { JwtUser } from "../../types/jwt.js";

export const PICKUP_SELECT = {
  id: true, userId: true, storeId: true, orderId: true, reason: true, resolvedAt: true,
  /** Cash refunds are handed over by the rider on collection */
  remedy: true, refundTo: true, approvedAmount: true,
  items: {
    select: {
      quantity: true,
      orderItem: {
        select: {
          product: { select: { name: true, imageUrl: true, images: true } },
          variant: { select: { name: true, imageUrl: true } },
        },
      },
    },
  },
} as const;

/** Returns waiting for a rider to collect, keyed by customer and store */
export async function pendingPickups(prisma: PrismaClient, pairs: { userId: string; storeId: string }[]) {
  const rows = await prisma.returnRequest.findMany({
    where: pairs.length === 0 ? { id: { in: [] } } : { status: "IN_PROGRESS", method: "NEXT_ORDER", receivedAt: null, OR: pairs },
    select: PICKUP_SELECT,
    orderBy: { createdAt: "asc" },
  });
  const byCustomer = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.userId}:${r.storeId}`;
    byCustomer.set(key, [...(byCustomer.get(key) ?? []), r]);
  }
  return byCustomer;
}

/** Why this member can't collect a return while delivering this order, or null when they can */
export async function collectDenial(
  prisma: PrismaClient,
  user: JwtUser,
  rr: { userId: string; storeId: string },
  orderId: string,
): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, storeId: true, status: true, deliveryTrip: { select: { riderId: true } } },
  });
  if (!order || order.userId !== rr.userId || order.storeId !== rr.storeId) return "This order isn't from the same customer and store";
  if (order.status !== "OUT_FOR_DELIVERY" && order.status !== "DELIVERED") return "Collect returns while delivering the customer's order";
  if (user.role === "SUPER_ADMIN" || hasPermission(user.permissions, Permission.RETURNS_HANDLE)) return null;
  return order.deliveryTrip?.riderId === user.sub ? null : "This order isn't on your trip";
}
