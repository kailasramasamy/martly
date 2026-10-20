import { activeLocale } from "./index";

/** A date in the shopper's language, e.g. "20 Oct" or "20 அக்." */
export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString(activeLocale(), options);
}

export function formatTime(date: Date | string, options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }) {
  return new Date(date).toLocaleTimeString(activeLocale(), options);
}
