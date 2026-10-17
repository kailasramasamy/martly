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
