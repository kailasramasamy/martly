import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { Permission } from "@martly/shared/constants";
import { sendNotification, sendLoyaltyNotification } from "../notification.js";
import { notifyStaff, notifyOrgStaff } from "./staff.js";
import { formatINR, formatISTDate, formatOrderRef, plural } from "./copy.js";

type Fcm = Messaging | null;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

async function customerName(prisma: PrismaClient, userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name || "A customer";
}

interface StaffTarget {
  storeId?: string | null;
  organizationId?: string | null;
}

async function alertServiceStaff(
  fcm: Fcm,
  prisma: PrismaClient,
  target: StaffTarget,
  permissions: Permission[],
  alert: { title: string; body: string; data: Record<string, unknown> },
  escalation = false,
) {
  const full = { type: "STAFF_SERVICE" as const, ...alert };
  if (target.storeId) await notifyStaff(fcm, prisma, target.storeId, { permissions, escalation }, full);
  else if (target.organizationId) await notifyOrgStaff(fcm, prisma, target.organizationId, { permissions, escalation }, full);
}

export async function notifyReturnRequested(
  fcm: Fcm,
  prisma: PrismaClient,
  rr: { id: string; orderId: string; userId: string; storeId: string; requestedAmount: number; itemCount: number },
) {
  const name = await customerName(prisma, rr.userId);
  await alertServiceStaff(fcm, prisma, { storeId: rr.storeId }, ["RETURNS_HANDLE"], {
    title: `Return requested · ${formatINR(rr.requestedAmount)}`,
    body: `${name} · ${plural(rr.itemCount, "item")} · order ${formatOrderRef(rr.orderId)}`,
    data: { screen: "manage-return", returnRequestId: rr.id },
  });
}

export async function notifyTicketCreated(fcm: Fcm, prisma: PrismaClient, ticketId: string, summary: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, subject: true, storeId: true, organizationId: true, userId: true },
  });
  if (!ticket) return;
  const name = await customerName(prisma, ticket.userId);
  await alertServiceStaff(fcm, prisma, ticket, ["SUPPORT_HANDLE"], {
    title: clip(`Support ticket · ${ticket.subject}`, 60),
    body: `${name}: ${clip(summary, 80)}`,
    data: { screen: "manage-ticket", ticketId: ticket.id },
  });
}

export async function notifyTicketUpdated(
  fcm: Fcm,
  prisma: PrismaClient,
  ticket: { id: string; userId: string; subject: string },
  change: { status?: string; reply?: string },
) {
  const resolved = change.status === "RESOLVED" || change.status === "CLOSED";
  const copy = change.reply
    ? { title: "New reply on your ticket", body: clip(change.reply, 100) }
    : resolved ? { title: "Ticket resolved", body: ticket.subject } : null;
  if (!copy) return;
  await sendNotification(fcm, prisma, {
    userId: ticket.userId, type: "SUPPORT_UPDATE", ...copy, data: { screen: "support-ticket", ticketId: ticket.id },
  });
}

export async function notifyReviewCreated(
  fcm: Fcm,
  prisma: PrismaClient,
  review: { id: string; rating: number; storeId: string | null; productId: string },
) {
  const product = await prisma.product.findUnique({ where: { id: review.productId }, select: { name: true, organizationId: true } });
  if (!product) return;
  const title = review.rating <= 2 ? `Low rating ★${review.rating} · ${product.name}` : "Review needs approval";
  await alertServiceStaff(fcm, prisma, { storeId: review.storeId, organizationId: review.storeId ? null : product.organizationId }, ["MARKETING_MANAGE"], {
    title: clip(title, 60),
    body: review.rating <= 2 ? "A low-rated review is waiting for moderation." : `A new review of ${product.name} is waiting for moderation.`,
    data: { screen: "manage-reviews" },
  });
}

export async function notifyReviewReplied(fcm: Fcm, prisma: PrismaClient, review: { userId: string; productId: string }, body: string) {
  await sendNotification(fcm, prisma, {
    userId: review.userId,
    type: "SUPPORT_UPDATE",
    title: "The store replied to your review",
    body: clip(body, 100),
    data: { screen: "product", productId: review.productId },
  });
}

export async function notifyReviewModerated(
  fcm: Fcm,
  prisma: PrismaClient,
  review: { userId: string; productId: string },
  outcome: { status: string; rewardPoints: number },
) {
  if (outcome.status === "APPROVED" && outcome.rewardPoints > 0) {
    await sendLoyaltyNotification(fcm, prisma, review.userId, "EARN", outcome.rewardPoints, "for your review");
  } else if (outcome.status === "REJECTED") {
    await sendNotification(fcm, prisma, {
      userId: review.userId,
      type: "SUPPORT_UPDATE",
      title: "Review not published",
      body: "Your review didn't meet our review guidelines, so it wasn't published.",
      data: { screen: "product", productId: review.productId },
    });
  }
}

export async function notifyStoreRating(
  fcm: Fcm,
  prisma: PrismaClient,
  rating: { storeId: string; overallRating: number; deliveryRating: number | null; comment: string | null },
) {
  const low = rating.overallRating <= 2;
  if (!low && rating.overallRating !== 3 && !(rating.deliveryRating != null && rating.deliveryRating <= 2)) return;
  await alertServiceStaff(fcm, prisma, { storeId: rating.storeId }, ["STORE_SETTINGS"], {
    title: `Low store rating ★${rating.overallRating}`,
    body: rating.comment ? clip(rating.comment, 100) : "A customer left a low rating without a comment.",
    data: { screen: "store-ratings" },
  }, low);
}

export async function notifyMembershipWelcome(fcm: Fcm, prisma: PrismaClient, userId: string, planName: string, endDate: Date) {
  await sendNotification(fcm, prisma, {
    userId,
    type: "MEMBERSHIP",
    title: clip(`Welcome to ${planName}!`, 40),
    body: `Your benefits are active until ${formatISTDate(endDate)}.`,
    data: { screen: "membership" },
  });
}

export async function notifyReferralApplied(
  fcm: Fcm,
  prisma: PrismaClient,
  referral: { referrerId: string; refereeId: string; referrerReward: number; refereeReward: number },
) {
  const refereeName = await customerName(prisma, referral.refereeId);
  await Promise.all([
    sendNotification(fcm, prisma, {
      userId: referral.referrerId,
      type: "REFERRAL",
      title: "Your friend joined Martly",
      body: `${refereeName} used your code. You'll get ${formatINR(referral.referrerReward)} after their first delivery.`,
      data: { screen: "referral" },
    }),
    sendNotification(fcm, prisma, {
      userId: referral.refereeId,
      type: "REFERRAL",
      title: "Referral code applied",
      body: `${formatINR(referral.refereeReward)} will be added to your wallet after your first delivery.`,
      data: { screen: "referral" },
    }),
  ]);
}
