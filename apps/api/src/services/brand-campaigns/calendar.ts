import type { AdProduct } from "../../../generated/prisma/client.js";
import { addDays, istDay } from "../ist-day.js";
import { windowFor } from "./booking.js";
import { firstFit, heldInSlot, peakRunning, slotCap, type Db } from "./slots.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const HELD_SELECT = {
  id: true, title: true, status: true, startsAt: true, endsAt: true, brand: { select: { id: true, name: true, imageUrl: true } },
} as const;

/**
 * The package's slot day by day (IST) for a booking of this length: how full each day is, who holds it, and the
 * earliest moment that day a booking could start and still fit for its whole length (null when it can't start that day).
 * Uses the same counting as booking, so the calendar and the save agree.
 */
export async function slotCalendar(
  db: Db,
  q: { product: AdProduct; quantity: number; categoryId?: string | null; excludeId?: string; days: number },
) {
  const now = new Date();
  const today = istDay();
  const [cap, held] = await Promise.all([
    slotCap(db, q.product),
    heldInSlot(db, { product: q.product, categoryId: q.categoryId, excludeId: q.excludeId, after: today.start }, HELD_SELECT),
  ]);
  const { startsAt, endsAt } = windowFor(q.product, q.quantity, now);
  const length = endsAt.getTime() - startsAt.getTime();
  const days = Array.from({ length: q.days }, (_, i) => {
    const date = addDays(today.key, i);
    const start = istDay(date).start.getTime();
    const end = start + DAY_MS;
    const fit = firstFit(held, cap, length, i === 0 ? now.getTime() : start, end);
    const running = held.filter((h) => h.startsAt.getTime() < end && h.endsAt.getTime() > start);
    return {
      date,
      booked: peakRunning(running, start, end),
      startsAt: fit === null ? null : new Date(fit),
      campaigns: running.map((h) => ({ id: h.id, title: h.title, status: h.status, startsAt: h.startsAt, endsAt: h.endsAt, brand: h.brand })),
    };
  });
  return { cap, days };
}
