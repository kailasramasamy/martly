import { transitionPermission } from "@martly/shared/order-flow";
import { hasPermission } from "@martly/shared/permissions";
import { Permission } from "@martly/shared/constants";
import type { JwtUser } from "../types/jwt.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Why this member may not move the order into `to`, or null when allowed.
 * Riders without dispatch rights may only deliver orders on their own in-progress trip.
 */
export async function transitionDenial(
  prisma: PrismaClient,
  user: JwtUser,
  order: { deliveryTripId: string | null },
  to: string,
): Promise<string | null> {
  if (user.role === "SUPER_ADMIN") return null;
  const needed = transitionPermission(to);
  if (hasPermission(user.permissions, needed)) return null;

  if (to === "DELIVERED" && order.deliveryTripId && hasPermission(user.permissions, Permission.DELIVERY_DELIVER)) {
    const trip = await prisma.deliveryTrip.findUnique({ where: { id: order.deliveryTripId }, select: { riderId: true } });
    if (trip?.riderId === user.sub) return null;
  }
  return to === "CANCELLED" ? "You don't have permission to cancel orders" : "You don't have permission to update this order";
}
