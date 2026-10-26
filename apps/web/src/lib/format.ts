/** ₹1,234, with paise only when the price has them */
export function rupees(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}
