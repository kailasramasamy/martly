/** Empty text is "no value" (null); anything else that isn't a number is NaN so callers can reject it */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
}

export function numberText(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
