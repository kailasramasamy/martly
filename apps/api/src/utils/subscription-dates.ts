/**
 * Shared helpers for subscription delivery-date calculations.
 * Used by both the subscription routes and the scheduler plugin.
 *
 * All Date objects here represent UTC midnight for a given calendar date.
 * We use UTC methods (.getUTCDay(), .setUTCDate(), etc.) so behaviour is
 * identical regardless of the server's system timezone.
 */

export function calculateNextDeliveryDate(
  frequency: string,
  selectedDays: number[],
  fromDate?: Date,
): Date {
  const base = fromDate ?? new Date();
  const tomorrow = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + 1,
  ));

  if (frequency === "DAILY" || frequency === "ALTERNATE_DAYS") {
    return tomorrow;
  }

  if (frequency === "SPECIFIC_DAYS") {
    for (let i = 0; i < 7; i++) {
      const candidate = new Date(tomorrow);
      candidate.setUTCDate(candidate.getUTCDate() + i);
      if (selectedDays.includes(candidate.getUTCDay())) {
        return candidate;
      }
    }
  }

  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    // selectedDays[0] is target day of week (0-6)
    const targetDay = selectedDays[0] ?? 0;
    for (let i = 0; i < 7; i++) {
      const candidate = new Date(tomorrow);
      candidate.setUTCDate(candidate.getUTCDate() + i);
      if (candidate.getUTCDay() === targetDay) {
        return candidate;
      }
    }
  }

  if (frequency === "MONTHLY") {
    // selectedDays[0] is target day of month (1-28)
    const targetDate = selectedDays[0] ?? 1;
    const candidate = new Date(tomorrow);
    // If the target day this month is still in the future, use it
    if (candidate.getUTCDate() <= targetDate) {
      candidate.setUTCDate(targetDate);
      return candidate;
    }
    // Otherwise, move to the target day next month
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    candidate.setUTCDate(targetDate);
    return candidate;
  }

  return tomorrow;
}

export function advanceNextDeliveryDate(
  current: Date,
  frequency: string,
  selectedDays: number[],
): Date {
  const next = new Date(current);

  if (frequency === "DAILY") {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (frequency === "ALTERNATE_DAYS") {
    next.setUTCDate(next.getUTCDate() + 2);
    return next;
  }

  if (frequency === "SPECIFIC_DAYS") {
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(current);
      candidate.setUTCDate(candidate.getUTCDate() + i);
      if (selectedDays.includes(candidate.getUTCDay())) {
        return candidate;
      }
    }
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (frequency === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (frequency === "BIWEEKLY") {
    next.setUTCDate(next.getUTCDate() + 14);
    return next;
  }

  if (frequency === "MONTHLY") {
    // Same day next month
    const targetDate = selectedDays[0] ?? next.getUTCDate();
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(targetDate);
    return next;
  }

  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function isDeliveryDay(
  date: Date,
  frequency: string,
  selectedDays: number[],
  subscriptionCreatedAt: Date,
): boolean {
  if (frequency === "DAILY") return true;

  if (frequency === "ALTERNATE_DAYS") {
    // First delivery is the day after creation (diffDays=1), then every 2 days (3,5,7...)
    const created = new Date(Date.UTC(
      subscriptionCreatedAt.getUTCFullYear(),
      subscriptionCreatedAt.getUTCMonth(),
      subscriptionCreatedAt.getUTCDate(),
    ));
    const target = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ));
    const diffDays = Math.round((target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays % 2 === 1;
  }

  if (frequency === "SPECIFIC_DAYS") {
    return selectedDays.includes(date.getUTCDay());
  }

  if (frequency === "WEEKLY") {
    return date.getUTCDay() === (selectedDays[0] ?? 0);
  }

  if (frequency === "BIWEEKLY") {
    if (date.getUTCDay() !== (selectedDays[0] ?? 0)) return false;
    // Check if it's an even number of weeks from creation
    const created = new Date(Date.UTC(
      subscriptionCreatedAt.getUTCFullYear(),
      subscriptionCreatedAt.getUTCMonth(),
      subscriptionCreatedAt.getUTCDate(),
    ));
    const target = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ));
    const diffDays = Math.round((target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.round(diffDays / 7);
    return diffWeeks % 2 === 0;
  }

  if (frequency === "MONTHLY") {
    return date.getUTCDate() === (selectedDays[0] ?? 1);
  }

  return false;
}
