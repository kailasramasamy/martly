import type { PrismaClient } from "../../../generated/prisma/client.js";
import { addDays, istDay, istNow, istWeekday } from "../ist-day.js";
import { slotCapacity } from "./settings.js";

// How far ahead customers can book
export const BOOKING_DAYS = 7;

/** Minutes past midnight as "HH:MM", wrapping a cutoff that falls the evening before */
function clockTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** A store's slots on an IST date with what's left to book; full and closed slots are kept so customers see why */
export async function slotsForDate(prisma: PrismaClient, storeId: string, date: string) {
  const now = istNow();
  const isToday = date === now.key;
  const slots = await prisma.deliverySlot.findMany({
    where: { storeId, dayOfWeek: istWeekday(date), isActive: true },
    orderBy: { startTime: "asc" },
  });
  if (slots.length === 0) return [];
  const { start, end } = istDay(date);
  const bookings = await prisma.order.groupBy({
    by: ["deliverySlotId"],
    where: { deliverySlotId: { in: slots.map((s) => s.id) }, scheduledDate: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    _count: true,
  });
  const booked = new Map(bookings.map((b) => [b.deliverySlotId, b._count]));
  const capacities = new Map(await Promise.all(slots.map(async (s) => [s.id, await slotCapacity(prisma, s, date)] as const)));

  return slots.map((slot) => {
    // A slot only sells what its riders can carry
    const capacity = capacities.get(slot.id) ?? slot.maxOrders;
    const available = capacity - (booked.get(slot.id) ?? 0);
    // Bookings close `cutoffMinutes` before the slot starts
    const [h, m] = slot.startTime.split(":").map(Number);
    const cutoff = h * 60 + m - slot.cutoffMinutes;
    return {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxOrders: capacity,
      available,
      full: available <= 0,
      closed: isToday && now.minutes >= cutoff,
      orderBy: clockTime(cutoff),
    };
  });
}

export interface OpenSlot {
  date: string;
  startTime: string;
  endTime: string;
  /** Last time to order for this slot, "HH:MM" IST */
  orderBy: string;
  /** Only a handful of orders left */
  fewLeft: boolean;
}

const FEW_LEFT = 3;

/** The next slots a customer could still book at each store, soonest first, within the booking window */
export async function upcomingSlots(prisma: PrismaClient, storeIds: string[], limit: number): Promise<Map<string, OpenSlot[]>> {
  const withSlots = await prisma.deliverySlot.findMany({ where: { storeId: { in: storeIds }, isActive: true }, distinct: ["storeId"], select: { storeId: true } });
  const today = istNow().key;
  const found = await Promise.all(withSlots.map(async ({ storeId }) => {
    const open: OpenSlot[] = [];
    for (let d = 0; d <= BOOKING_DAYS && open.length < limit; d++) {
      const date = addDays(today, d);
      for (const s of (await slotsForDate(prisma, storeId, date)).filter((x) => !x.full && !x.closed)) {
        open.push({ date, startTime: s.startTime, endTime: s.endTime, orderBy: s.orderBy, fewLeft: s.available <= FEW_LEFT });
      }
    }
    return [storeId, open.slice(0, limit)] as const;
  }));
  return new Map(found);
}
