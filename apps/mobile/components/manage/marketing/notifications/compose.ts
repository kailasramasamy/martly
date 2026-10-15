import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { parseNumber } from "../common";
import type { AudienceConfig } from "./types";

export interface Compose {
  title: string;
  body: string;
  type: string;
  imageUrl: string | null;
  audienceType: string;
  storeId: string | null;
  days: string;
  minAmount: string;
  deepLinkType: string;
  deepLinkId: string | null;
  schedule: boolean;
  scheduleDate: string | null;
  scheduleTime: string;
}

export const EMPTY_COMPOSE: Compose = {
  title: "", body: "", type: "PROMOTIONAL", imageUrl: null, audienceType: "ALL_CUSTOMERS", storeId: null, days: "30",
  minAmount: "1000", deepLinkType: "", deepLinkId: null, schedule: false, scheduleDate: null, scheduleTime: "10:00",
};

export function audienceConfigOf(c: Compose): AudienceConfig | undefined {
  if (c.audienceType === "STORE_CUSTOMERS" && c.storeId) return { storeId: c.storeId };
  if (c.audienceType === "ORDERED_LAST_N_DAYS" || c.audienceType === "NOT_ORDERED_N_DAYS") {
    const days = parseNumber(c.days);
    return days ? { days } : undefined;
  }
  if (c.audienceType === "HIGH_VALUE_CUSTOMERS") {
    const minAmount = parseNumber(c.minAmount);
    return minAmount ? { minAmount } : undefined;
  }
  return undefined;
}

export function scheduledAtOf(c: Compose): string | null {
  if (!c.schedule || !c.scheduleDate) return null;
  return new Date(`${c.scheduleDate}T${c.scheduleTime}:00`).toISOString();
}

export function validateCompose(c: Compose): Partial<Record<keyof Compose, string>> {
  const errors: Partial<Record<keyof Compose, string>> = {};
  if (!c.title.trim()) errors.title = "Enter a title";
  if (!c.body.trim()) errors.body = "Enter a message";
  if (c.audienceType === "STORE_CUSTOMERS" && !c.storeId) errors.storeId = "Choose a store";
  if (c.deepLinkType && !c.deepLinkId) errors.deepLinkId = "Choose a target";
  if (c.schedule) {
    if (!c.scheduleDate) errors.scheduleDate = "Pick a date";
    else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.scheduleTime)) errors.scheduleTime = "Use 24-hour HH:MM";
    else if (new Date(`${c.scheduleDate}T${c.scheduleTime}:00`).getTime() <= Date.now()) errors.scheduleDate = "Pick a time in the future";
  }
  return errors;
}

export function toSendPayload(c: Compose) {
  return {
    title: c.title.trim(),
    body: c.body.trim(),
    type: c.type,
    imageUrl: c.imageUrl ?? undefined,
    audienceType: c.audienceType,
    audienceConfig: audienceConfigOf(c),
    deepLinkType: c.deepLinkType || undefined,
    deepLinkId: c.deepLinkId ?? undefined,
    scheduledAt: scheduledAtOf(c) ?? undefined,
  };
}

/** Live audience size for the current segment; null while unknown or when the preview fails */
export function useAudienceCount(audienceType: string, config: AudienceConfig | undefined) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const configKey = JSON.stringify(config ?? null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api.post<{ count: number }>("/api/v1/notifications/admin/audience-preview", { audienceType, audienceConfig: JSON.parse(configKey) ?? undefined })
        .then((res) => !cancelled && setCount(res.data.count))
        .catch(() => !cancelled && setCount(null))
        .finally(() => !cancelled && setLoading(false));
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [audienceType, configKey]);

  return { count, loading };
}
