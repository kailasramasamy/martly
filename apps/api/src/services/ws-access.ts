import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { getOrgUser, verifyStoreOrgAccess } from "../middleware/org-scope.js";

/** verifyStoreOrgAccess lets shoppers through (they have no store scope), so they are ruled out first */
const NOT_STAFF = ["CUSTOMER", "GUEST", "BRAND_PARTNER"];

async function staffOfStore(request: FastifyRequest, prisma: PrismaClient, storeId: string) {
  if (NOT_STAFF.includes(getOrgUser(request).role)) return false;
  return verifyStoreOrgAccess(request, prisma, storeId);
}

/** Live updates of an order carry its address and items: only its customer and staff who can see its store get them */
export async function canWatchOrder(request: FastifyRequest, prisma: PrismaClient, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true, storeId: true } });
  if (!order) return false;
  return order.userId === getOrgUser(request).sub || staffOfStore(request, prisma, order.storeId);
}

/** A trip streams the rider's live location: its rider, customers with an order on it, and staff of its store */
export async function canWatchTrip(request: FastifyRequest, prisma: PrismaClient, tripId: string) {
  const trip = await prisma.deliveryTrip.findUnique({ where: { id: tripId }, select: { riderId: true, storeId: true } });
  if (!trip) return false;
  const { sub } = getOrgUser(request);
  if (trip.riderId === sub) return true;
  if (await staffOfStore(request, prisma, trip.storeId)) return true;
  return (await prisma.order.count({ where: { deliveryTripId: tripId, userId: sub } })) > 0;
}
