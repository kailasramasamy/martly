/**
 * A rupee amount for display, without the ₹: "1,234", or "1,234.50" when it has paise — orders carry paise (a 4%
 * discount, a member price), and rounding each line on its own makes a bill that doesn't add up.
 */
export function amount(value: number): string {
  const digits = Math.round(value * 100) % 100 === 0 ? 0 : 2;
  return value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
