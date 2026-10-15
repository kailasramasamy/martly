import { numberText, parseNumber } from "../delivery-config/numbers";
import type { StoreDetail } from "./types";

export interface StoreDraft {
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  address: string;
  phone: string;
  latitude: string;
  longitude: string;
  deliveryRadius: string;
  baseDeliveryFee: string;
  freeDeliveryThreshold: string;
  minOrderAmount: string;
  subscriptionEnabled: boolean;
  subscriptionDeliveryMode: string;
  subscriptionWindowStart: string | null;
  subscriptionWindowEnd: string | null;
  subscriptionCutoffTime: string;
}

const money = (v: string | null | undefined) => numberText(v === null || v === undefined ? null : Number(v));

export function emptyDraft(organizationId: string): StoreDraft {
  return {
    organizationId, name: "", slug: "", status: "PENDING", address: "", phone: "", latitude: "", longitude: "",
    deliveryRadius: "7", baseDeliveryFee: "", freeDeliveryThreshold: "", minOrderAmount: "",
    subscriptionEnabled: false, subscriptionDeliveryMode: "DEDICATED", subscriptionWindowStart: null,
    subscriptionWindowEnd: null, subscriptionCutoffTime: "22:00",
  };
}

export function draftFromStore(s: StoreDetail): StoreDraft {
  return {
    organizationId: s.organizationId, name: s.name, slug: s.slug, status: s.status, address: s.address,
    phone: s.phone ?? "", latitude: numberText(s.latitude), longitude: numberText(s.longitude),
    deliveryRadius: numberText(s.deliveryRadius), baseDeliveryFee: money(s.baseDeliveryFee),
    freeDeliveryThreshold: money(s.freeDeliveryThreshold), minOrderAmount: money(s.minOrderAmount),
    subscriptionEnabled: s.subscriptionEnabled, subscriptionDeliveryMode: s.subscriptionDeliveryMode,
    subscriptionWindowStart: s.subscriptionWindowStart, subscriptionWindowEnd: s.subscriptionWindowEnd,
    subscriptionCutoffTime: s.subscriptionCutoffTime,
  };
}

export const slugify = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

type Built = { payload: Record<string, unknown> } | { error: string };

function checkRequired(d: StoreDraft, creating: boolean): string | null {
  if (creating && !d.organizationId) return "Choose an organization";
  if (!d.name.trim()) return "Store name is required";
  if (!/^[a-z0-9-]+$/.test(d.slug)) return "Slug can only use lowercase letters, numbers and hyphens";
  if (!d.address.trim()) return "Address is required";
  return null;
}

function checkNumbers(d: StoreDraft): string | null {
  const [lat, lng, radius, ...amounts] = [d.latitude, d.longitude, d.deliveryRadius, d.baseDeliveryFee, d.freeDeliveryThreshold, d.minOrderAmount].map(parseNumber);
  if (lat !== null && !(lat >= -90 && lat <= 90)) return "Latitude must be between -90 and 90";
  if (lng !== null && !(lng >= -180 && lng <= 180)) return "Longitude must be between -180 and 180";
  if ((lat === null) !== (lng === null)) return "Set both latitude and longitude, or neither";
  if (radius !== null && !(radius > 0)) return "Delivery radius must be more than 0";
  if (amounts.some((a) => a !== null && !(a >= 0))) return "Amounts must be 0 or more";
  return null;
}

/** Create takes omitted values, update takes explicit nulls to clear a field */
export function buildStorePayload(d: StoreDraft, creating: boolean, initial: StoreDraft | null): Built {
  const error = checkRequired(d, creating) ?? checkNumbers(d);
  if (error) return { error };
  const clear = creating ? undefined : null;
  const num = (text: string) => parseNumber(text) ?? clear;
  const core = {
    name: d.name.trim(), slug: d.slug, address: d.address.trim(), phone: d.phone.trim() || clear,
    latitude: num(d.latitude), longitude: num(d.longitude), deliveryRadius: parseNumber(d.deliveryRadius) ?? undefined,
    baseDeliveryFee: num(d.baseDeliveryFee), freeDeliveryThreshold: num(d.freeDeliveryThreshold), minOrderAmount: num(d.minOrderAmount),
  };
  if (creating) return { payload: { ...core, organizationId: d.organizationId } };
  const changed = d.subscriptionEnabled !== initial?.subscriptionEnabled;
  return {
    payload: {
      ...core, status: d.status, ...(changed ? { subscriptionEnabled: d.subscriptionEnabled } : {}),
      subscriptionDeliveryMode: d.subscriptionDeliveryMode, subscriptionWindowStart: d.subscriptionWindowStart,
      subscriptionWindowEnd: d.subscriptionWindowEnd, subscriptionCutoffTime: d.subscriptionCutoffTime,
    },
  };
}
