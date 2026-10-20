import type { Messaging } from "firebase-admin/messaging";
import { LARGE_REFUND_ALERT, LedgerEntryTypeLabels } from "@martly/shared/constants";
import type { BalanceDue, PrismaClient, Settlement } from "../../../generated/prisma/client.js";
import { sendNotification } from "../notification.js";
import { claimOnce } from "./once.js";
import { formatINR, formatOrderRef } from "./copy.js";
import { notifyOrgStaff, notifyStaff } from "./staff.js";

type Fcm = Messaging | null;

const FINANCE = ["FINANCE_MANAGE" as const];
const settlementScreen = (s: Pick<Settlement, "id">) => ({ screen: "manage-settlement", settlementId: s.id });
const ownersOnly = { escalation: true };

/** What the weekly run decided for one organization; payouts waiting on bank details get the daily reminder instead */
export async function notifySettlement(fcm: Fcm, prisma: PrismaClient, s: Settlement) {
  const net = Number(s.net);
  if (s.status === "APPROVED") {
    await notifyOrgStaff(fcm, prisma, s.organizationId, { permissions: FINANCE, escalation: true }, {
      type: "STAFF_FINANCE", title: `${formatINR(net)} payout scheduled`, body: `${s.number} · see the statement in Payments`, data: settlementScreen(s),
    });
  } else if (s.status === "CARRIED_FORWARD" && net < 0) {
    await notifyOrgStaff(fcm, prisma, s.organizationId, ownersOnly, {
      type: "STAFF_FINANCE", title: "Refunds exceeded sales this week",
      body: `Balance −${formatINR(-net)}, recovered from your next payouts.`, data: settlementScreen(s),
    });
  }
}

export async function notifyBankDetailsMissing(fcm: Fcm, prisma: PrismaClient, organizationId: string, amount: number) {
  await notifyOrgStaff(fcm, prisma, organizationId, ownersOnly, {
    type: "STAFF_FINANCE", title: `Add your bank details to receive ${formatINR(amount)}`,
    body: "Payouts start once Martly verifies your account.", data: { screen: "manage-payout-account" },
  });
}

export async function notifyPayoutPaid(fcm: Fcm, prisma: PrismaClient, s: Settlement) {
  const account = await prisma.orgPayoutAccount.findUnique({ where: { organizationId: s.organizationId }, select: { accountLast4: true, upiVpa: true } });
  const to = s.payoutMethod === "UPI" ? account?.upiVpa ?? "your UPI ID" : `••${account?.accountLast4 ?? ""}`;
  await notifyOrgStaff(fcm, prisma, s.organizationId, ownersOnly, {
    type: "STAFF_FINANCE", title: `${formatINR(Number(s.net))} paid to ${to}`, body: `${s.number} · UTR ${s.utr}`, data: settlementScreen(s),
  });
}

export async function notifyPayoutFailed(fcm: Fcm, prisma: PrismaClient, s: Settlement) {
  await notifyOrgStaff(fcm, prisma, s.organizationId, ownersOnly, {
    type: "STAFF_FINANCE", title: `Payout of ${formatINR(Number(s.net))} failed`,
    body: `${s.failureReason ?? "The bank rejected it"}. Check your details in Payments.`, data: { screen: "manage-payout-account" },
  });
}

export async function notifyDueRaised(fcm: Fcm, prisma: PrismaClient, due: BalanceDue) {
  await notifyOrgStaff(fcm, prisma, due.organizationId, ownersOnly, {
    type: "STAFF_FINANCE", title: `${formatINR(Number(due.amount))} is due to Martly`,
    body: "Refunds have outrun sales for four weeks. Pay from Payments.", data: { screen: "manage-finance" },
  });
}

export async function notifyDuePaid(fcm: Fcm, prisma: PrismaClient, due: BalanceDue) {
  await notifyOrgStaff(fcm, prisma, due.organizationId, ownersOnly, {
    type: "STAFF_FINANCE", title: `${formatINR(Number(due.amount))} balance payment received`,
    body: "Your balance has been credited.", data: { screen: "manage-finance" },
  });
}

export async function notifyAdjustment(fcm: Fcm, prisma: PrismaClient, organizationId: string, amount: number, reason: string) {
  const signed = `${amount < 0 ? "−" : "+"}${formatINR(Math.abs(amount))}`;
  await notifyOrgStaff(fcm, prisma, organizationId, ownersOnly, {
    type: "STAFF_FINANCE", title: `Martly adjusted your balance by ${signed}`, body: reason, data: { screen: "manage-finance" },
  });
}

/** A security alert: every owner hears about it, the person who changed it included */
export async function notifyPayoutAccountChanged(fcm: Fcm, prisma: PrismaClient, organizationId: string, changedBy: string) {
  const user = await prisma.user.findUnique({ where: { id: changedBy }, select: { name: true } });
  await notifyOrgStaff(fcm, prisma, organizationId, ownersOnly, {
    type: "STAFF_FINANCE", title: `Payout account changed by ${user?.name ?? "a team member"}`,
    body: "Payouts pause until Martly verifies the new details.", data: { screen: "manage-payout-account" },
  });
}

/** Martly's finance team: a run produced payouts to make */
export async function notifySettlementRunFinished(fcm: Fcm, prisma: PrismaClient, scheduled: Settlement[]) {
  if (scheduled.length === 0) return;
  const total = scheduled.reduce((n, s) => n + Number(s.net), 0);
  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", deletedAt: null }, select: { id: true } });
  await Promise.all(admins.map(({ id }) => sendNotification(fcm, prisma, {
    userId: id, type: "STAFF_FINANCE", title: `${scheduled.length} settlement${scheduled.length === 1 ? "" : "s"} ready to pay`,
    body: `${formatINR(total)} in the payout queue`, data: {}, sound: true,
  })));
}

/** Martly's finance team: an owner or store questions a ledger entry; the ticket is in admin's support tickets */
export async function notifyLedgerQuery(fcm: Fcm, prisma: PrismaClient, organizationName: string, memo: string) {
  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", deletedAt: null }, select: { id: true } });
  await Promise.all(admins.map(({ id }) => sendNotification(fcm, prisma, {
    userId: id, type: "STAFF_FINANCE", title: `Ledger query · ${organizationName}`, body: memo, data: {}, sound: true,
  })));
}

const LARGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Large refund debits alert the store's finance staff once each; swept so it never slows the refund itself */
export async function alertLargeRefunds(fcm: Fcm, prisma: PrismaClient, now = new Date()) {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      type: { in: ["RETURN_REFUND", "DOOR_REFUND", "GOODWILL_DEBIT"] }, amount: { lte: -LARGE_REFUND_ALERT },
      storeId: { not: null }, createdAt: { gte: new Date(now.getTime() - LARGE_WINDOW_MS) },
    },
    include: { store: { select: { name: true } } },
  });
  const fresh = await claimOnce(prisma, entries.map((e) => `ledger-large:${e.id}`));
  for (const e of entries.filter((x) => fresh.has(`ledger-large:${x.id}`))) {
    const on = e.orderId ? ` on order ${formatOrderRef(e.orderId)}` : "";
    await notifyStaff(fcm, prisma, e.storeId!, { permissions: FINANCE }, {
      type: "STAFF_FINANCE", title: `${formatINR(-Number(e.amount))} ${LedgerEntryTypeLabels[e.type].toLowerCase()}${on}`,
      body: `Debited to ${e.store?.name ?? "your store"}`, data: { screen: "manage-ledger-entry", entryId: e.id },
    });
  }
}
