import { isAxiosError } from "axios";
import { PAYMENT_CANCELLED } from "../../components/RazorpayPay";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";

/** Invoice links are signed paths on the API and expire after 15 minutes, so render them from freshly fetched data */
export const invoiceHref = (path: string) => `${API_URL}${path}`;

/** The message to show for a failed call; anything that isn't an API or payment-window error is a bug and rethrown */
export function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) return err.response?.data?.message ?? fallback;
  if (err instanceof Error && err.name === PAYMENT_CANCELLED) return "Payment cancelled";
  throw err;
}
