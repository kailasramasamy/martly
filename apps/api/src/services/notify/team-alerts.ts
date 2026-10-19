import type { Messaging } from "firebase-admin/messaging";
import { UserRoleLabels, type UserRole } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { OPEN_ORDER_STATUSES } from "../ist-day.js";
import { sendNotification } from "../notification.js";
import { formatOrderRef, plural } from "./copy.js";

type TeamEvent =
  | { kind: "added" | "removed"; storeId: string }
  | { kind: "role"; role: string }
  | { kind: "access" };

/** Tells a team member their own standing changed; the person who made the change isn't told */
export async function notifyTeamMember(fcm: Messaging | null, prisma: PrismaClient, userId: string, actorId: string, event: TeamEvent) {
  if (userId === actorId) return;
  let title: string;
  if (event.kind === "role") title = `Your role is now ${UserRoleLabels[event.role as UserRole] ?? event.role}`;
  else if (event.kind === "access") title = "Your access has been updated";
  else {
    const store = await prisma.store.findUnique({ where: { id: event.storeId }, select: { name: true } });
    if (!store) return;
    title = event.kind === "added" ? `You've been added to ${store.name}` : `You've been removed from ${store.name}`;
  }
  await sendNotification(fcm, prisma, { userId, type: "STAFF_TEAM", title, body: "Open your profile to see what you can do.", data: { screen: "manage-profile" }, sound: true });
}

interface StoreRef {
  id: string;
  name: string;
}

async function unavailableAlerts(prisma: PrismaClient, store: StoreRef) {
  const [orders, subscriptions] = await Promise.all([
    prisma.order.findMany({ where: { storeId: store.id, status: { in: [...OPEN_ORDER_STATUSES] } }, select: { id: true, userId: true }, orderBy: { createdAt: "desc" } }),
    prisma.subscription.findMany({ where: { storeId: store.id, status: "ACTIVE" }, select: { id: true, userId: true } }),
  ]);
  const paused = "Your subscription deliveries are paused until it reopens.";
  const subscribed = new Map(subscriptions.map((s) => [s.userId, s.id]));
  const ordersByUser = new Map<string, string[]>();
  for (const o of orders) ordersByUser.set(o.userId, [...(ordersByUser.get(o.userId) ?? []), o.id]);

  const alerts = new Map<string, { body: string; data: Record<string, unknown> }>();
  for (const [userId, subscriptionId] of subscribed) alerts.set(userId, { body: paused, data: { screen: "subscription", subscriptionId } });
  // Orders are newest first: name the latest, count the rest
  for (const [userId, [latest, ...others]] of ordersByUser) {
    const more = others.length > 0 ? ` and ${plural(others.length, "other order")}` : "";
    const body = `The store will contact you about order ${formatOrderRef(latest)}${more}.${subscribed.has(userId) ? ` ${paused}` : ""}`;
    alerts.set(userId, { body, data: { screen: "order", orderId: latest } });
  }
  return [...alerts].map(([userId, alert]) => ({ userId, title: `${store.name} is temporarily unavailable`, ...alert }));
}

async function reopenedAlerts(prisma: PrismaClient, store: StoreRef) {
  const subscriptions = await prisma.subscription.findMany({ where: { storeId: store.id, status: "ACTIVE" }, select: { id: true, userId: true } });
  const first = new Map(subscriptions.map((s) => [s.userId, s.id]));
  return [...first].map(([userId, subscriptionId]) => ({
    userId, title: `${store.name} is open again`, body: "Your subscription deliveries will continue.", data: { screen: "subscription", subscriptionId },
  }));
}

/** Customers with open orders or active subscriptions hear when their store closes or suspends, and when it comes back */
export async function notifyStoreStatusChange(fcm: Messaging | null, prisma: PrismaClient, store: StoreRef, from: string, to: string) {
  const down = (status: string) => status === "SUSPENDED" || status === "CLOSED";
  let alerts: Awaited<ReturnType<typeof unavailableAlerts>> = [];
  if (down(to) && !down(from)) alerts = await unavailableAlerts(prisma, store);
  else if (to === "ACTIVE" && down(from)) alerts = await reopenedAlerts(prisma, store);
  await Promise.all(alerts.map((alert) => sendNotification(fcm, prisma, { type: "STORE_NOTICE", ...alert })));
}
