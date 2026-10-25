import type { Messaging } from "firebase-admin/messaging";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { istNow } from "../ist-day.js";
import { sendNotification } from "../notification.js";
import { claimOnce } from "../notify/once.js";
import { formatINR } from "../notify/copy.js";
import { sendTemplate } from "../whatsapp/interakt.js";
import { listMonth, monthlyListView } from "./index.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Log = { info: (msg: string) => void; error: (err: unknown, msg: string) => void };

// One list's reminder: the total at today's prices and what changed, by push and (when on) WhatsApp
async function remind(fcm: Messaging | null, prisma: PrismaClient, listId: string, log: Log) {
  const list = await prisma.monthlyList.findUnique({
    where: { id: listId },
    select: { userId: true, pushOn: true, whatsappOn: true, user: { select: { name: true, phone: true } }, store: { select: { name: true } } },
  });
  if (!list) return;
  const view = await monthlyListView(prisma, list.userId, { id: listId });
  if (!view || view.items.length === 0) return;
  const monthName = MONTH_NAMES[Number(view.month.slice(5, 7)) - 1];
  const changed = view.items.filter((i) => i.delta != null && i.delta !== 0).length;
  const total = formatINR(view.total);
  if (list.pushOn) {
    await sendNotification(fcm, prisma, {
      userId: list.userId, type: "GENERAL",
      title: `Your ${monthName} list is ready`,
      body: `${view.items.length} items · ${total} at today's prices${changed ? `. ${changed} prices changed` : ""}. Tap to check and order.`,
      data: { screen: "monthly-list", storeId: view.storeId },
    });
  }
  const template = process.env.INTERAKT_MONTHLY_LIST_TEMPLATE;
  if (list.whatsappOn && template && list.user.phone) {
    const result = await sendTemplate({
      phone: list.user.phone, template, language: process.env.INTERAKT_TEMPLATE_LANGUAGE ?? "en",
      bodyValues: [list.user.name.split(" ")[0] || "there", monthName, list.store.name, String(view.items.length), total],
      callbackData: `monthly-list:${listId}:${view.month}`,
    }, log.info);
    if (!result.sent && result.reason === "failed") log.error(result.detail, `Interakt send failed for monthly list ${listId}`);
  }
}

/** Reminds every active list whose day is today and that hasn't been reminded this month; safe to run more than once */
export async function sendMonthlyListReminders(fcm: Messaging | null, prisma: PrismaClient, log: Log) {
  const day = Number(istNow().key.slice(8, 10));
  const month = listMonth();
  const due = await prisma.monthlyList.findMany({
    // "Not this month" must keep the never-reminded and never-ordered lists, which a plain `not` would drop with the nulls
    where: {
      isActive: true, reminderDay: { lte: day },
      AND: [
        { OR: [{ lastRemindedMonth: null }, { lastRemindedMonth: { not: month } }] },
        { OR: [{ lastOrderedMonth: null }, { lastOrderedMonth: { not: month } }] },
      ],
    },
    select: { id: true },
  });
  // A restart or a second instance never reminds the same list twice in a month
  const won = await claimOnce(prisma, due.map((l) => `monthly-list:${l.id}:${month}`));
  let sent = 0;
  for (const { id } of due) {
    if (!won.has(`monthly-list:${id}:${month}`)) continue;
    try {
      await remind(fcm, prisma, id, log);
      await prisma.monthlyList.update({ where: { id }, data: { lastRemindedMonth: month } });
      sent += 1;
    } catch (err) {
      log.error(err, `Monthly list reminder failed for ${id}`);
    }
  }
  log.info(`Monthly list reminders: ${sent} sent`);
  return sent;
}
