import crypto from "crypto";
import Razorpay from "razorpay";
import type { PrismaClient } from "../../generated/prisma/index.js";

const keyId = process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!keyId || !keySecret) {
      throw Object.assign(new Error("Razorpay is not configured"), { statusCode: 503 });
    }
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayInstance;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(keyId && keySecret);
}

export function getRazorpayKeyId(): string {
  return keyId;
}

export async function createRazorpayOrder(amountInPaise: number, orderId: string, customerId?: string, notes?: Record<string, string>) {
  const rp = getRazorpay();
  return rp.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: orderId,
    ...(customerId ? { customer_id: customerId } : {}),
    ...(notes ? { notes } : {}),
  });
}

/** Razorpay rejected a call; its status must not leak through as our own (a 401 would log users out) */
class PaymentProviderError extends Error {
  name = "PaymentProviderError";
  statusCode = 502;
}

const SUBSCRIPTIONS_OFF = "Auto-renewing plans need Razorpay Subscriptions switched on for this account";

interface RazorpayFailure {
  statusCode?: number;
  error?: { description?: string } | string;
}

/** Runs a Razorpay call; `notEnabled` is the message when the account lacks the feature (Razorpay answers 401, or 400 for UPI) */
async function providerCall<T>(work: () => Promise<T>, notEnabled: string, notEnabledStatuses: number[] = [401]): Promise<T> {
  try {
    return await work();
  } catch (err) {
    const failure = err as RazorpayFailure;
    if (typeof failure?.statusCode !== "number") throw err;
    const reason = typeof failure.error === "object" ? failure.error?.description : failure.error;
    throw new PaymentProviderError(
      notEnabledStatuses.includes(failure.statusCode)
        ? notEnabled
        : `The payment provider refused the request${reason ? `: ${reason}` : ""}`,
    );
  }
}

export function isUpiS2SEnabled(): boolean {
  return process.env.RAZORPAY_UPI_S2S === "true";
}

interface UpiIntentInput {
  razorpayOrderId: string;
  amountInPaise: number;
  contact: string;
  email: string | null;
  customerId?: string;
  ip: string;
  userAgent: string;
}

/** Starts a server-to-server UPI intent payment; the link opens the customer's UPI app */
export async function createUpiIntentPayment(input: UpiIntentInput) {
  const res = await providerCall(() => getRazorpay().payments.createUpi({
    amount: input.amountInPaise,
    currency: "INR",
    order_id: input.razorpayOrderId,
    email: input.email || "void@razorpay.com",
    contact: input.contact,
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    method: "upi",
    ip: input.ip,
    referer: "https://martly.app",
    user_agent: input.userAgent,
    upi: { flow: "intent", expiry_time: 5 },
    notes: {},
  }), "UPI intent payments are not enabled for this account", [400, 401]);
  if (!res.link) throw new PaymentProviderError("The payment provider returned no UPI link");
  return { paymentId: res.razorpay_payment_id, link: res.link };
}

/** The id of a captured payment against a Razorpay order, or null while none has succeeded */
export async function findCapturedPayment(razorpayOrderId: string): Promise<string | null> {
  const { items } = await getRazorpay().orders.fetchPayments(razorpayOrderId);
  return items.find((payment) => payment.status === "captured")?.id ?? null;
}

/** A Razorpay plan billing an amount in paise (GST included) every month or every year */
export async function createRazorpayPlan(name: string, amountInPaise: number, period: "monthly" | "yearly") {
  const plan = await providerCall(() => getRazorpay().plans.create({
    period, interval: 1, item: { name, amount: amountInPaise, currency: "INR" },
  }), SUBSCRIPTIONS_OFF);
  return plan.id;
}

/** A subscription billing the plan every period; with startAt the mandate is set up now and the first charge waits */
export async function createRazorpaySubscription(planId: string, notes: Record<string, string>, startAt?: Date) {
  return providerCall(() => getRazorpay().subscriptions.create({
    plan_id: planId, total_count: notes.interval === "YEARLY" ? 10 : 120, customer_notify: 1, notes,
    ...(startAt ? { start_at: Math.floor(startAt.getTime() / 1000) } : {}),
  }), SUBSCRIPTIONS_OFF);
}

export async function cancelRazorpaySubscription(subscriptionId: string, atCycleEnd: boolean) {
  return providerCall(() => getRazorpay().subscriptions.cancel(subscriptionId, atCycleEnd), SUBSCRIPTIONS_OFF);
}

/** The checkout handler's signature for a subscription's first payment */
export function verifySubscriptionSignature(paymentId: string, subscriptionId: string, signature: string): boolean {
  return hmacMatches(keySecret, `${paymentId}|${subscriptionId}`, signature);
}

/** Refunds a captured payment in full */
export async function refundRazorpayPayment(paymentId: string) {
  return getRazorpay().payments.refund(paymentId, {});
}

export async function ensureRazorpayCustomer(
  prisma: PrismaClient,
  userId: string,
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.razorpayCustomerId) return user.razorpayCustomerId;

  const rp = getRazorpay();
  const customer = await (rp.customers as { create: (opts: Record<string, unknown>) => Promise<{ id: string }> }).create({
    name: user.name,
    email: user.email,
    ...(user.phone ? { contact: user.phone } : {}),
    fail_existing: 0,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { razorpayCustomerId: customer.id },
  });

  return customer.id;
}

export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  return hmacMatches(keySecret, body, signature);
}

/** Checks the X-Razorpay-Signature of a webhook against the raw request body */
export function verifyRazorpayWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  return Boolean(secret) && hmacMatches(secret, rawBody, signature);
}

function hmacMatches(secret: string, body: string, signature: string) {
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
