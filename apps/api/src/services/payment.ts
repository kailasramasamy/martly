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

export async function createRazorpayOrder(amountInPaise: number, orderId: string, customerId?: string) {
  const rp = getRazorpay();
  return rp.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: orderId,
    ...(customerId ? { customer_id: customerId } : {}),
  });
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
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  return expected === signature;
}
